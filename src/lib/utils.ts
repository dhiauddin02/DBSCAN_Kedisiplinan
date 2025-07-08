/**
 * Utility functions for the application
 */

// Retry function with exponential backoff
export const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Check if it's a rate limit error
      const isRateLimit = error instanceof Error && (
        error.message.includes('rate') ||
        error.message.includes('429') ||
        error.message.includes('Too Many Requests') ||
        error.message.includes('Request rate limit reached')
      );
      
      // If it's the last attempt or not a rate limit error, throw the error
      if (attempt === maxRetries || !isRateLimit) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.log(`Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
      
      await sleep(delay);
    }
  }
  
  throw lastError!;
};

// Sleep utility function
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Generate email from student name and NIM
export const generateEmail = (namaMahasiswa: string, nim: string): string => {
  // Format nama: lowercase, spasi jadi underscore
  const namaFormatted = namaMahasiswa
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, ''); // Remove special characters except underscore
  
  // Ambil 3 digit terakhir NIM
  const nimStr = nim.toString();
  const lastThreeDigits = nimStr.slice(-3).padStart(3, '0');
  
  return `${namaFormatted}${lastThreeDigits}@student.pnl.ac.id`;
};

// Batch processing utility
export const processBatch = async <T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  batchSize: number = 5,
  delayBetweenBatches: number = 1000
): Promise<R[]> => {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    // Process batch in parallel
    const batchPromises = batch.map((item, batchIndex) => 
      processor(item, i + batchIndex)
    );
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    // Collect results
    batchResults.forEach((result, batchIndex) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error(`Error processing item ${i + batchIndex}:`, result.reason);
        // You might want to handle errors differently based on your needs
      }
    });
    
    // Add delay between batches to avoid rate limiting
    if (i + batchSize < items.length) {
      await sleep(delayBetweenBatches);
    }
  }
  
  return results;
};