import { supabase } from './supabase';

export const clusteringAPI = {
  async processFile(file: File, sheetName: string) {
    const apiUrl = import.meta.env.VITE_CLUSTERING_API_URL;
    
    if (!apiUrl) {
      throw new Error('Clustering API URL not configured. Please set VITE_CLUSTERING_API_URL in your environment variables.');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('sheet_name', sheetName);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Clustering API error (${response.status}): ${errorText || 'Unknown error'}`);
      }

      return response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Cannot connect to clustering service. Please ensure the clustering API server is running.');
      }
      throw error;
    }
  }
};

export const fontteAPI = {
  async sendWhatsApp(target: string, message: string) {
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': import.meta.env.VITE_FONNTE_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target,
        message,
        countryCode: '62'
      })
    });

    return response.json();
  }
};

export const databaseAPI = {
  async getAllClusteringResults() {
    const { data, error } = await supabase
      .from('hasil_clustering')
      .select(`
        *,
        user:users(*),
        batch:batch(
          *,
          periode:periode(*)
        )
      `);

    if (error) throw error;
    return data;
  },

  async saveClusteringResults(results: any[], batchId: string) {
    // First, check if there are existing results for this batch
    const { data: existingResults, error: checkError } = await supabase
      .from('hasil_clustering')
      .select('id')
      .eq('id_batch', batchId);

    if (checkError) {
      console.error('Error checking existing results:', checkError);
      throw checkError;
    }

    // If there are existing results, delete them first
    if (existingResults && existingResults.length > 0) {
      const { error: deleteError } = await supabase
        .from('hasil_clustering')
        .delete()
        .eq('id_batch', batchId);

      if (deleteError) {
        console.error('Error deleting existing results:', deleteError);
        throw deleteError;
      }
    }

    // Prepare clustering data
    const clusteringData = results
      .filter(result => result.user_id) // Only include results with valid user_id
      .map(result => ({
        id_user: result.user_id,
        id_batch: batchId,
        nim: result.NIM?.toString() || '',
        nama_mahasiswa: result['Nama Mahasiswa'] || '',
        tingkat: result.TINGKAT || '',
        kelas: result.KELAS || '',
        total_a: Number(result.TOTAL_A) || 0,
        jp: Number(result.JP) || 0,
        kedisiplinan: result.KEDISIPLINAN || '',
        cluster: result.Cluster?.toString() || '0',
        insight: result.Insight || '',
        nilai_matkul: result || {},
        status_pesan: 'belum terkirim'
      }));

    if (clusteringData.length === 0) {
      throw new Error('Tidak ada data valid untuk disimpan');
    }

    // Insert new results
    const { data, error } = await supabase
      .from('hasil_clustering')
      .insert(clusteringData)
      .select();

    if (error) {
      console.error('Error inserting clustering results:', error);
      throw error;
    }

    return data;
  },

  async createPeriode(namaPeriode: string, semester?: string) {
    const { data, error } = await supabase
      .from('periode')
      .insert({ 
        nama_periode: namaPeriode,
        semester: semester || null
      })
      .select();

    if (error) throw error;
    return data;
  },

  async createBatch(namaBatch: string, idPeriode: string) {
    const { data, error } = await supabase
      .from('batch')
      .insert({ 
        nama_batch: namaBatch, 
        id_periode: idPeriode,
        tgl_batch: new Date().toISOString().split('T')[0]
      })
      .select();

    if (error) throw error;
    return data;
  }
};