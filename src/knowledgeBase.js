import fs from 'fs-extra';
import { join } from 'path';
import { config } from './config.js';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';

class KnowledgeBase {
  constructor() {
    this.vectorStore = null;
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.openai.apiKey,
    });
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
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

      const documents = [];
      const fileStats = [];

      for (const file of txtFiles) {
        const filePath = join(knowledgePath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Split the content into chunks
        const chunks = await this.splitter.createDocuments(
          [content],
          [{ source: file }]
        );

        documents.push(...chunks);
        fileStats.push({ name: file, chunks: chunks.length });
      }

      if (documents.length > 0) {
        // Create vector store from documents
        this.vectorStore = await MemoryVectorStore.fromDocuments(
          documents,
          this.embeddings
        );
        console.log(`📚 Loading knowledge base:`);
        fileStats.forEach(stat => {
          console.log(`   ✓ ${stat.name}: ${stat.chunks} chunk(s)`);
        });
        console.log(`   ✅ Total: ${documents.length} chunks from ${txtFiles.length} file(s)`);
      }
    } catch (error) {
      console.error('Error loading knowledge base:', error);
      throw error;
    }
  }

  async search(query, k = 5) {
    if (!this.vectorStore) {
      return [];
    }

    try {
      const results = await this.vectorStore.similaritySearch(query, k);
      return results.map(doc => doc.pageContent);
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
    return this.vectorStore !== null;
  }
}

export default new KnowledgeBase();

