import fs from 'fs-extra';
import { join } from 'path';
import { config } from './config.js';

class KnowledgeBase {
  constructor() {
    this.allContent = ''; // Store all content from all .txt files
    this.fileContents = new Map(); // Store content by filename
  }

  async loadKnowledgeBase() {
    try {
      const knowledgePath = config.knowledgeBase.path;
      const files = await fs.readdir(knowledgePath);
      // Only include .txt files (exclude .md and other files)
      const knowledgeFiles = files.filter(file => 
        file.endsWith('.txt') &&
        !file.toLowerCase().includes('readme') &&
        !file.toLowerCase().includes('example')
      );

      if (knowledgeFiles.length === 0) {
        console.log('No .txt files found in knowledge base directory');
        return;
      }

      const allContents = [];
      const fileStats = [];

      // Load all knowledge files and combine their content
      for (const file of knowledgeFiles) {
        const filePath = join(knowledgePath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Store content by filename
        this.fileContents.set(file, content);
        
        // Add to combined content
        allContents.push(`\n\n=== ${file} ===\n${content}`);
        
        // Calculate file size
        const sizeKB = (content.length / 1024).toFixed(2);
        fileStats.push({ name: file, size: sizeKB });
      }

      // Combine all content
      this.allContent = allContents.join('\n\n');

      console.log(`📚 Loading knowledge base:`);
      fileStats.forEach(stat => {
        console.log(`   ✓ ${stat.name}: ${stat.size} KB`);
      });
      console.log(`   ✅ Total: ${(this.allContent.length / 1024).toFixed(2)} KB from ${knowledgeFiles.length} .txt file(s)`);
      console.log(`📚 Knowledge base loaded successfully! All content is available for AI.`);
    } catch (error) {
      console.error('Error loading knowledge base:', error);
      throw error;
    }
  }

  // Get all content from all .txt files
  getAllContent() {
    return this.allContent || '';
  }

  // Get content from a specific file
  getFileContent(filename) {
    return this.fileContents.get(filename) || '';
  }

  // Get list of all loaded files
  getLoadedFiles() {
    return Array.from(this.fileContents.keys());
  }


  isLoaded() {
    return this.allContent.length > 0;
  }
  
  getContentSize() {
    return {
      totalSize: (this.allContent.length / 1024).toFixed(2) + ' KB',
      fileCount: this.fileContents.size,
      files: Array.from(this.fileContents.keys())
    };
  }

  // Get list of perfume titles from titles.txt
  getPerfumeTitles() {
    try {
      const titlesPath = join(config.knowledgeBase.path, 'titles.txt');
      if (!fs.existsSync(titlesPath)) {
        console.warn('titles.txt file not found');
        return [];
      }
      
      const content = fs.readFileSync(titlesPath, 'utf-8');
      const titles = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      return titles;
    } catch (error) {
      console.error('Error reading perfume titles:', error);
      return [];
    }
  }
}

export default new KnowledgeBase();

