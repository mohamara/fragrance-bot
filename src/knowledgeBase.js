import fs from 'fs-extra';
import { join } from 'path';
import { config } from './config.js';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';

class KnowledgeBase {
  constructor() {
    this.titlesStore = null; // Vector store for titles only
    this.detailsStore = null; // Vector store for full details (fa.txt, en.txt)
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.openai.apiKey,
    });
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    this.titlesMap = new Map(); // Map to store perfume titles
    this.perfumeDetails = new Map(); // Map to store full perfume details
  }

  async loadKnowledgeBase() {
    try {
      const knowledgePath = config.knowledgeBase.path;
      const files = await fs.readdir(knowledgePath);
      const txtFiles = files.filter(file => file.endsWith('.txt'));

      if (txtFiles.length === 0) {
        console.log('No .txt files found in knowledge base directory');
        return;
      }

      // Step 1: Load titles.txt first
      const titlesFile = txtFiles.find(f => f === 'titles.txt');
      if (titlesFile) {
        const titlesPath = join(knowledgePath, titlesFile);
        const titlesContent = await fs.readFile(titlesPath, 'utf-8');
        const titles = titlesContent.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);
        
        // Store titles in map
        titles.forEach(title => {
          this.titlesMap.set(title.toUpperCase(), title);
        });

        // Create vector store for titles
        const titlesDocs = titles.map(title => ({
          pageContent: title,
          metadata: { type: 'title', original: title }
        }));
        
        this.titlesStore = await MemoryVectorStore.fromDocuments(
          titlesDocs,
          this.embeddings
        );
        console.log(`📚 Loaded ${titles.length} perfume titles`);
      }

      // Step 2: Load detail files (fa.txt, en.txt, and other detail files)
      const detailFiles = txtFiles.filter(f => 
        f !== 'titles.txt' && 
        (f === 'fa.txt' || f === 'en.txt' || !f.includes('title'))
      );

      const detailDocuments = [];
      const fileStats = [];

      for (const file of detailFiles) {
        const filePath = join(knowledgePath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Parse perfume details from content
        this.parsePerfumeDetails(content, file);
        
        // Split the content into chunks
        const chunks = await this.splitter.createDocuments(
          [content],
          [{ source: file, type: 'detail' }]
        );

        detailDocuments.push(...chunks);
        fileStats.push({ name: file, chunks: chunks.length });
      }

      if (detailDocuments.length > 0) {
        // Create vector store for details
        this.detailsStore = await MemoryVectorStore.fromDocuments(
          detailDocuments,
          this.embeddings
        );
        console.log(`📚 Loading perfume details:`);
        fileStats.forEach(stat => {
          console.log(`   ✓ ${stat.name}: ${stat.chunks} chunk(s)`);
        });
        console.log(`   ✅ Total: ${detailDocuments.length} chunks from ${detailFiles.length} file(s)`);
      }

      console.log(`📚 Knowledge base loaded successfully!`);
      console.log(`   Titles: ${this.titlesMap.size}`);
      console.log(`   Perfumes in details: ${this.perfumeDetails.size}`);
    } catch (error) {
      console.error('Error loading knowledge base:', error);
      throw error;
    }
  }

  parsePerfumeDetails(content, sourceFile) {
    // Parse perfume details from content
    // This helps us map titles to their full details
    const isPersian = sourceFile === 'fa.txt';
    
    // Split by double newlines or lines that start with "عطر" or "L'DORA" or perfume names
    const perfumeBlocks = content.split(/\n\s*\n/).filter(block => block.trim().length > 0);
    
    perfumeBlocks.forEach(block => {
      const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) return;
      
      // Extract perfume name (first line usually contains the name)
      const firstLine = lines[0];
      let perfumeName = '';
      
      if (isPersian) {
        // For Persian: "عطر L'DORA: آگار عود امبر" or "عطر HYRCANIA"
        const patterns = [
          /عطر\s+L'DORA:\s*(.+)/,
          /عطر\s+(.+)/,
          /^(.+?)(?:\s*$|$)/ // Fallback: take first line
        ];
        
        for (const pattern of patterns) {
          const match = firstLine.match(pattern);
          if (match && match[1]) {
            perfumeName = match[1].trim();
            break;
          }
        }
      } else {
        // For English: "L'DORA FRAGRANCE: AGAR OUD AMBER" or "HYRCANIA"
        const patterns = [
          /L'DORA\s+FRAGRANCE:\s*(.+)/,
          /^([A-Z][A-Z\s]+?)(?:\s*Type:|\s*$)/, // Match uppercase perfume names
          /^(.+?)(?:\s*$|$)/ // Fallback
        ];
        
        for (const pattern of patterns) {
          const match = firstLine.match(pattern);
          if (match && match[1]) {
            perfumeName = match[1].trim();
            break;
          }
        }
      }
      
      if (perfumeName && perfumeName.length > 1) {
        const key = perfumeName.toUpperCase().trim();
        if (!this.perfumeDetails.has(key)) {
          this.perfumeDetails.set(key, []);
        }
        this.perfumeDetails.get(key).push({
          content: block.trim(),
          source: sourceFile,
          language: isPersian ? 'fa' : 'en'
        });
      }
    });
  }

  async search(query, k = 5) {
    try {
      const relevantPerfumes = [];
      const usedPerfumes = new Set();
      
      // Step 1: Search in titles first to find relevant perfume names (intelligent matching)
      if (this.titlesStore) {
        // Search for more titles to have better coverage (search up to 15 titles)
        const titleResults = await this.titlesStore.similaritySearch(query, Math.min(k * 3, 15));
        const foundTitles = titleResults.map(doc => doc.pageContent.trim().toUpperCase());
        
        // Step 2: For each found title, get its full details
        for (const titleUpper of foundTitles) {
          if (usedPerfumes.has(titleUpper)) continue;
          
          // Try to find exact match in titles map
          const originalTitle = this.titlesMap.get(titleUpper);
          if (originalTitle) {
            // Get details for this perfume
            const details = this.perfumeDetails.get(titleUpper);
            if (details && details.length > 0) {
              // Prefer Persian if available, otherwise English
              const persianDetail = details.find(d => d.language === 'fa');
              const detail = persianDetail || details[0];
              relevantPerfumes.push(detail.content);
              usedPerfumes.add(titleUpper);
              
              // Stop if we have enough results
              if (relevantPerfumes.length >= k) break;
            }
          }
        }
      }
      
      // Step 3: If we don't have enough results, search in details store for additional context
      if (this.detailsStore && relevantPerfumes.length < k) {
        const remaining = k - relevantPerfumes.length;
        const detailResults = await this.detailsStore.similaritySearch(query, remaining * 2);
        
        // Add unique details (avoid duplicates)
        const existingContent = new Set(relevantPerfumes);
        for (const doc of detailResults) {
          if (relevantPerfumes.length >= k) break;
          if (!existingContent.has(doc.pageContent)) {
            relevantPerfumes.push(doc.pageContent);
            existingContent.add(doc.pageContent);
          }
        }
      }
      
      // Return top k results
      return relevantPerfumes.slice(0, k);
    } catch (error) {
      console.error('Error searching knowledge base:', error);
      return [];
    }
  }

  async addText(text, metadata = {}) {
    if (!this.vectorStore) {
      // Initialize empty vector store
      this.vectorStore = await MemoryVectorStore.fromDocuments(
        [],
        this.embeddings
      );
    }

    const chunks = await this.splitter.createDocuments(
      [text],
      [metadata]
    );
    
    // Add documents to existing vector store
    await this.vectorStore.addDocuments(chunks);
  }

  isLoaded() {
    return this.titlesStore !== null || this.detailsStore !== null;
  }
  
  getPerfumeCount() {
    return {
      titles: this.titlesMap.size,
      details: this.perfumeDetails.size
    };
  }
}

export default new KnowledgeBase();

