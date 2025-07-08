import React, { useState, useEffect } from 'react';
import { Upload, UserPlus, Users, AlertCircle, CheckCircle, FileSpreadsheet, Save, Eye, Edit, Trash2, Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateEmail, retryWithBackoff } from '../lib/utils';
import * as XLSX from 'xlsx';

interface StudentData {
  nim: string;
  nama: string;
  nama_wali: string;
  no_wa_wali: string;
  nama_dosen_pembimbing: string;
  no_wa_dosen_pembimbing: string;
}

interface ExistingStudent extends StudentData {
  id: string;
  email: string;
  created_at: string;
}

export default function TambahMahasiswa() {
  const [activeTab, setActiveTab] = useState<'manual' | 'upload'>('manual');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [processedData, setProcessedData] = useState<StudentData[]>([]);
  const [existingStudents, setExistingStudents] = useState<ExistingStudent[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<ExistingStudent | null>(null);
  const [clusteringHistory, setClusteringHistory] = useState<any[]>([]);
  const [processingProgress, setProcessingProgress] = useState<{ 
    current: number; 
    total: number; 
    currentStudent: string;
    status: 'processing' | 'success' | 'error' | 'skipped';
  } | null>(null);
  
  // Form data for manual input
  const [formData, setFormData] = useState<StudentData>({
    nim: '',
    nama: '',
    nama_wali: '',
    no_wa_wali: '',
    nama_dosen_pembimbing: '',
    no_wa_dosen_pembimbing: ''
  });

  useEffect(() => {
    loadExistingStudents();
  }, []);

  const loadExistingStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'mahasiswa')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExistingStudents(data || []);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        setFile(selectedFile);
        setMessage(null);
        setProcessedData([]);
      } else {
        setMessage({ type: 'error', text: 'File harus berformat .xlsx atau .xls' });
      }
    }
  };

  const processExcelFile = async () => {
    if (!file) {
      setMessage({ type: 'error', text: 'Pilih file terlebih dahulu' });
      return;
    }

    setLoading(true);
    setMessage({ type: 'info', text: 'Memproses file Excel...' });

    try {
      // Read the Excel file
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // Get the first sheet (or you can specify a sheet name)
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert sheet to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length < 2) {
        throw new Error('File Excel harus memiliki minimal 2 baris (header dan data)');
      }

      // Get headers from first row
      const headers = jsonData[0] as string[];
      console.log('Headers found:', headers);

      // Find column indices (case insensitive and flexible matching)
      const findColumnIndex = (possibleNames: string[]) => {
        return headers.findIndex(header => 
          possibleNames.some(name => 
            header?.toString().toLowerCase().includes(name.toLowerCase())
          )
        );
      };

      const nimIndex = findColumnIndex(['nim', 'nomor induk']);
      const namaIndex = findColumnIndex(['nama', 'nama mahasiswa', 'nama lengkap']);
      const namaWaliIndex = findColumnIndex(['nama wali', 'wali', 'nama orang tua', 'orang tua']);
      const noWaWaliIndex = findColumnIndex(['no wa wali', 'wa wali', 'nomor wa wali', 'whatsapp wali', 'no hp wali']);
      const namaDosenIndex = findColumnIndex(['nama dosen', 'dosen pembimbing', 'nama dosen pembimbing', 'pembimbing']);
      const noWaDosenIndex = findColumnIndex(['no wa dosen', 'wa dosen', 'nomor wa dosen', 'whatsapp dosen', 'no hp dosen']);

      // Validate required columns
      const missingColumns = [];
      if (nimIndex === -1) missingColumns.push('NIM');
      if (namaIndex === -1) missingColumns.push('Nama');
      if (namaWaliIndex === -1) missingColumns.push('Nama Wali');
      if (noWaWaliIndex === -1) missingColumns.push('No. WA Wali');
      if (namaDosenIndex === -1) missingColumns.push('Nama Dosen Pembimbing');
      if (noWaDosenIndex === -1) missingColumns.push('No. WA Dosen Pembimbing');

      if (missingColumns.length > 0) {
        throw new Error(`Kolom tidak ditemukan: ${missingColumns.join(', ')}. Pastikan file Excel memiliki kolom yang sesuai.`);
      }

      // Process data rows (skip header)
      const studentsData: StudentData[] = [];
      
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        
        // Skip empty rows
        if (!row || row.length === 0 || !row[nimIndex]) continue;

        // Clean and validate data
        const nim = row[nimIndex]?.toString().trim();
        const nama = row[namaIndex]?.toString().trim();
        const namaWali = row[namaWaliIndex]?.toString().trim();
        const noWaWali = row[noWaWaliIndex]?.toString().trim();
        const namaDosenPembimbing = row[namaDosenIndex]?.toString().trim();
        const noWaDosenPembimbing = row[noWaDosenIndex]?.toString().trim();

        // Validate required fields
        if (!nim || !nama || !namaWali || !noWaWali || !namaDosenPembimbing || !noWaDosenPembimbing) {
          console.warn(`Baris ${i + 1}: Data tidak lengkap, dilewati`);
          continue;
        }

        // Format phone numbers (remove spaces, dashes, and ensure proper format)
        const formatPhoneNumber = (phone: string) => {
          let formatted = phone.replace(/[\s\-\(\)]/g, '');
          // If starts with 0, replace with 62
          if (formatted.startsWith('0')) {
            formatted = '62' + formatted.substring(1);
          }
          // If doesn't start with 62, add it
          if (!formatted.startsWith('62')) {
            formatted = '62' + formatted;
          }
          return formatted;
        };

        studentsData.push({
          nim,
          nama,
          nama_wali: namaWali,
          no_wa_wali: formatPhoneNumber(noWaWali),
          nama_dosen_pembimbing: namaDosenPembimbing,
          no_wa_dosen_pembimbing: formatPhoneNumber(noWaDosenPembimbing)
        });
      }

      if (studentsData.length === 0) {
        throw new Error('Tidak ada data mahasiswa yang valid ditemukan dalam file');
      }

      setProcessedData(studentsData);
      setMessage({ 
        type: 'success', 
        text: `Berhasil memproses ${studentsData.length} data mahasiswa dari file Excel!` 
      });

    } catch (error) {
      console.error('Processing error:', error);
      let errorMessage = 'Gagal memproses file Excel';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setMessage({ type: 'error', text: errorMessage });
      setProcessedData([]);
    } finally {
      setLoading(false);
    }
  };

  const createStudentAuth = async (studentData: StudentData) => {
    try {
      const email = generateEmail(studentData.nama, studentData.nim);
      
      // Use retry with backoff for auth operations
      const authResult = await retryWithBackoff(async () => {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email,
          password: studentData.nim, // Use NIM as default password
          options: {
            data: {
              nama: studentData.nama,
              nim: studentData.nim,
              role: 'mahasiswa'
            }
          }
        });

        if (authError) {
          console.error('Auth signup error:', authError);
          throw authError;
        }

        if (!authData.user) {
          throw new Error('No user returned from signup');
        }

        return authData;
      }, 5, 2000); // 5 retries with 2 second base delay

      // Step 2: Insert into public.users table
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authResult.user.id,
          email: email,
          nim: studentData.nim,
          nama: studentData.nama,
          nama_wali: studentData.nama_wali,
          no_wa_wali: studentData.no_wa_wali,
          nama_dosen_pembimbing: studentData.nama_dosen_pembimbing,
          no_wa_dosen_pembimbing: studentData.no_wa_dosen_pembimbing,
          role: 'mahasiswa',
          level_user: 0
        });

      if (userError) {
        console.error('User insert error:', userError);
        throw userError;
      }

      return { success: true, student: studentData };
    } catch (error) {
      console.error('Error creating student:', error);
      return { success: false, error, student: studentData };
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.nim || !formData.nama || !formData.nama_wali || !formData.no_wa_wali || 
        !formData.nama_dosen_pembimbing || !formData.no_wa_dosen_pembimbing) {
      setMessage({ type: 'error', text: 'Semua field harus diisi' });
      return;
    }

    // Check if NIM already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('nim')
      .eq('nim', formData.nim)
      .maybeSingle();

    if (existingUser) {
      setMessage({ type: 'error', text: 'NIM sudah terdaftar dalam sistem' });
      return;
    }

    setLoading(true);
    
    const result = await createStudentAuth(formData);
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Mahasiswa berhasil ditambahkan!' });
      setFormData({
        nim: '',
        nama: '',
        nama_wali: '',
        no_wa_wali: '',
        nama_dosen_pembimbing: '',
        no_wa_dosen_pembimbing: ''
      });
      setShowAddModal(false);
      loadExistingStudents();
    } else {
      let errorMessage = 'Gagal menambahkan mahasiswa';
      if (result.error && typeof result.error === 'object' && 'message' in result.error) {
        errorMessage = result.error.message;
      }
      setMessage({ type: 'error', text: errorMessage });
    }
    
    setLoading(false);
  };

  const handleBulkSubmit = async () => {
    if (processedData.length === 0) {
      setMessage({ type: 'error', text: 'Tidak ada data untuk disimpan' });
      return;
    }

    setLoading(true);
    
    try {
      // Filter out students with existing NIMs first
      const studentsToProcess = [];
      const skippedStudents = [];

      for (const student of processedData) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('nim')
          .eq('nim', student.nim)
          .maybeSingle();

        if (existingUser) {
          skippedStudents.push(student);
        } else {
          studentsToProcess.push(student);
        }
      }

      if (studentsToProcess.length === 0) {
        setMessage({ type: 'error', text: 'Semua mahasiswa sudah terdaftar dalam sistem' });
        setLoading(false);
        return;
      }

      // Process students one by one sequentially
      let successCount = 0;
      let errorCount = 0;
      const failedStudents = [];

      for (let i = 0; i < studentsToProcess.length; i++) {
        const student = studentsToProcess[i];
        
        // Update progress
        setProcessingProgress({
          current: i + 1,
          total: studentsToProcess.length,
          currentStudent: `${student.nama} (${student.nim})`,
          status: 'processing'
        });

        try {
          // Wait 1 second before each request to avoid rate limiting
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          const result = await createStudentAuth(student);
          
          if (result.success) {
            successCount++;
            setProcessingProgress(prev => prev ? { ...prev, status: 'success' } : null);
            
            // Brief pause to show success status
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            errorCount++;
            failedStudents.push({
              student,
              error: result.error?.message || 'Unknown error'
            });
            setProcessingProgress(prev => prev ? { ...prev, status: 'error' } : null);
            
            // Brief pause to show error status
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          errorCount++;
          failedStudents.push({
            student,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          setProcessingProgress(prev => prev ? { ...prev, status: 'error' } : null);
          
          // Brief pause to show error status
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      const skippedCount = skippedStudents.length;

      let messageText = `Proses selesai! Berhasil: ${successCount}`;
      if (errorCount > 0) {
        messageText += `, Gagal: ${errorCount}`;
      }
      if (skippedCount > 0) {
        messageText += `, Sudah terdaftar: ${skippedCount}`;
      }

      setMessage({ 
        type: successCount > 0 ? 'success' : 'error', 
        text: messageText
      });

      // Log detailed errors for failed students
      if (failedStudents.length > 0) {
        console.log('Failed students:', failedStudents);
      }

      if (successCount > 0) {
        setProcessedData([]);
        setFile(null);
        loadExistingStudents();
      }

    } catch (error) {
      console.error('Bulk submit error:', error);
      setMessage({ type: 'error', text: 'Terjadi kesalahan saat memproses data mahasiswa' });
    } finally {
      setLoading(false);
      setProcessingProgress(null);
    }
  };

  const handleEdit = (student: ExistingStudent) => {
    setSelectedStudent(student);
    setFormData({
      nim: student.nim,
      nama: student.nama,
      nama_wali: student.nama_wali || '',
      no_wa_wali: student.no_wa_wali || '',
      nama_dosen_pembimbing: student.nama_dosen_pembimbing || '',
      no_wa_dosen_pembimbing: student.no_wa_dosen_pembimbing || ''
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from('users')
        .update({
          nama: formData.nama,
          nama_wali: formData.nama_wali,
          no_wa_wali: formData.no_wa_wali,
          nama_dosen_pembimbing: formData.nama_dosen_pembimbing,
          no_wa_dosen_pembimbing: formData.no_wa_dosen_pembimbing,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedStudent.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Data mahasiswa berhasil diperbarui!' });
      setShowEditModal(false);
      setSelectedStudent(null);
      loadExistingStudents();
    } catch (error) {
      console.error('Error updating student:', error);
      setMessage({ type: 'error', text: 'Gagal memperbarui data mahasiswa' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (student: ExistingStudent) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus mahasiswa ${student.nama}?`)) {
      return;
    }

    setLoading(true);

    try {
      // Delete from public.users (will cascade to auth.users via RLS)
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', student.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Mahasiswa berhasil dihapus!' });
      loadExistingStudents();
    } catch (error) {
      console.error('Error deleting student:', error);
      setMessage({ type: 'error', text: 'Gagal menghapus mahasiswa' });
    } finally {
      setLoading(false);
    }
  };

  const handleViewHistory = async (student: ExistingStudent) => {
    setSelectedStudent(student);
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('hasil_clustering')
        .select(`
          *,
          batch:batch(*, periode:periode(*))
        `)
        .eq('id_user', student.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setClusteringHistory(data || []);
      setShowHistoryModal(true);
    } catch (error) {
      console.error('Error loading clustering history:', error);
      setMessage({ type: 'error', text: 'Gagal memuat riwayat clustering' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nim: '',
      nama: '',
      nama_wali: '',
      no_wa_wali: '',
      nama_dosen_pembimbing: '',
      no_wa_dosen_pembimbing: ''
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Tambah Mahasiswa</h1>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          message.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center">
            {message.type === 'success' && <CheckCircle className="w-5 h-5 mr-2" />}
            {message.type === 'error' && <AlertCircle className="w-5 h-5 mr-2" />}
            {message.type === 'info' && <AlertCircle className="w-5 h-5 mr-2" />}
            {message.text}
          </div>
        </div>
      )}

      {/* Processing Progress */}
      {processingProgress && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">
              Memproses mahasiswa satu per satu...
            </span>
            <span className="text-sm text-blue-700">
              {processingProgress.current} / {processingProgress.total}
            </span>
          </div>
          
          <div className="w-full bg-blue-200 rounded-full h-3 mb-3">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${(processingProgress.current / processingProgress.total) * 100}%` }}
            ></div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-800">
              Sedang memproses: {processingProgress.currentStudent}
            </span>
            <div className="flex items-center">
              {processingProgress.status === 'processing' && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              )}
              {processingProgress.status === 'success' && (
                <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
              )}
              {processingProgress.status === 'error' && (
                <AlertCircle className="w-4 h-4 text-red-600 mr-2" />
              )}
              <span className={`text-xs font-medium ${
                processingProgress.status === 'processing' ? 'text-blue-600' :
                processingProgress.status === 'success' ? 'text-green-600' :
                processingProgress.status === 'error' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {processingProgress.status === 'processing' ? 'Memproses...' :
                 processingProgress.status === 'success' ? 'Berhasil' :
                 processingProgress.status === 'error' ? 'Gagal' : 'Menunggu...'}
              </span>
            </div>
          </div>
          
          <p className="text-xs text-blue-600 mt-2">
            Sistem memproses mahasiswa satu per satu dengan jeda 1 detik untuk menghindari rate limit.
          </p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('manual')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'manual'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Input Manual
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'upload'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Upload Excel
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'manual' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Input Data Mahasiswa</h3>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors duration-150 flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Mahasiswa
                </button>
              </div>
              <p className="text-gray-600">
                Klik tombol "Tambah Mahasiswa" untuk menambahkan data mahasiswa satu per satu.
              </p>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Upload File Excel</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      File Excel (.xlsx)
                    </label>
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <FileSpreadsheet className="w-8 h-8 mb-4 text-gray-500" />
                          <p className="mb-2 text-sm text-gray-500">
                            <span className="font-semibold">Click to upload</span> atau drag and drop
                          </p>
                          <p className="text-xs text-gray-500">Excel files (.xlsx, .xls)</p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept=".xlsx,.xls"
                          onChange={handleFileChange}
                        />
                      </label>
                    </div>
                    {file && (
                      <p className="mt-2 text-sm text-green-600">
                        File selected: {file.name}
                      </p>
                    )}
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Format File Excel:</h4>
                    <p className="text-sm text-blue-800 mb-2">File harus memiliki header kolom sebagai berikut (nama kolom fleksibel):</p>
                    <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                      <li><strong>NIM</strong> - Nomor Induk Mahasiswa (tipe: Text/Number)</li>
                      <li><strong>Nama</strong> - Nama Lengkap Mahasiswa (tipe: Text)</li>
                      <li><strong>Nama Wali</strong> - Nama Orang Tua/Wali (tipe: Text)</li>
                      <li><strong>No. WA Wali</strong> - Nomor WhatsApp Wali (tipe: Text/Number)</li>
                      <li><strong>Nama Dosen Pembimbing</strong> - Nama Dosen (tipe: Text)</li>
                      <li><strong>No. WA Dosen Pembimbing</strong> - Nomor WhatsApp Dosen (tipe: Text/Number)</li>
                    </ul>
                    <div className="mt-3 p-3 bg-blue-100 rounded">
                      <p className="text-xs text-blue-800">
                        <strong>Tips:</strong> Nama kolom bisa bervariasi (contoh: "NIM", "Nomor Induk", "No WA Wali", "WhatsApp Wali", dll). 
                        Sistem akan mencari kolom yang sesuai secara otomatis.
                      </p>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-900 mb-2">Informasi Proses Sequential:</h4>
                    <p className="text-sm text-yellow-800">
                      Sistem akan memproses mahasiswa satu per satu dengan jeda 1 detik antar mahasiswa untuk menghindari rate limit. 
                      Proses ini memastikan semua mahasiswa berhasil didaftarkan tanpa ada yang gagal karena rate limit.
                    </p>
                  </div>

                  <button
                    onClick={processExcelFile}
                    disabled={!file || loading}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 mr-2" />
                        Proses Dataset
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Processed Data Preview */}
              {processedData.length > 0 && (
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-medium text-gray-900">Preview Data ({processedData.length} mahasiswa)</h4>
                    <button
                      onClick={handleBulkSubmit}
                      disabled={loading || processingProgress !== null}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors duration-150 flex items-center disabled:opacity-50"
                    >
                      {loading || processingProgress ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      {processingProgress ? 'Memproses...' : 'Simpan Data (Sequential)'}
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NIM</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Wali</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No. WA Wali</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dosen Pembimbing</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No. WA Dosen</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {processedData.map((student, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.nim}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.nama}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.nama_wali}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.no_wa_wali}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.nama_dosen_pembimbing}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.no_wa_dosen_pembimbing}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Existing Students Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Mahasiswa Terdaftar ({existingStudents.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NIM</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Wali</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No. WA Wali</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dosen Pembimbing</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No. WA Dosen</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {existingStudents.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.nim}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.nama}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.nama_wali || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.no_wa_wali || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.nama_dosen_pembimbing || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.no_wa_dosen_pembimbing || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleViewHistory(student)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                        title="Lihat Riwayat Clustering"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(student)}
                        className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                        title="Edit Data"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(student)}
                        className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                        title="Hapus Mahasiswa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {existingStudents.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Belum ada mahasiswa yang terdaftar
            </div>
          )}
        </div>
      </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Tambah Mahasiswa Baru</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">NIM *</label>
                  <input
                    type="text"
                    value={formData.nim}
                    onChange={(e) => setFormData({...formData, nim: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nama Lengkap *</label>
                  <input
                    type="text"
                    value={formData.nama}
                    onChange={(e) => setFormData({...formData, nama: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nama Wali *</label>
                  <input
                    type="text"
                    value={formData.nama_wali}
                    onChange={(e) => setFormData({...formData, nama_wali: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">No. WA Wali *</label>
                  <input
                    type="tel"
                    value={formData.no_wa_wali}
                    onChange={(e) => setFormData({...formData, no_wa_wali: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nama Dosen Pembimbing *</label>
                  <input
                    type="text"
                    value={formData.nama_dosen_pembimbing}
                    onChange={(e) => setFormData({...formData, nama_dosen_pembimbing: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">No. WA Dosen Pembimbing *</label>
                  <input
                    type="tel"
                    value={formData.no_wa_dosen_pembimbing}
                    onChange={(e) => setFormData({...formData, no_wa_dosen_pembimbing: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Info Login:</strong> Mahasiswa akan dapat login menggunakan NIM sebagai username dan password.
                </p>
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors duration-150"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50 flex items-center justify-center"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Simpan
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {showEditModal && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Data Mahasiswa</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedStudent(null);
                  resetForm();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">NIM</label>
                  <input
                    type="text"
                    value={formData.nim}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">NIM tidak dapat diubah</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nama Lengkap *</label>
                  <input
                    type="text"
                    value={formData.nama}
                    onChange={(e) => setFormData({...formData, nama: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nama Wali *</label>
                  <input
                    type="text"
                    value={formData.nama_wali}
                    onChange={(e) => setFormData({...formData, nama_wali: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">No. WA Wali *</label>
                  <input
                    type="tel"
                    value={formData.no_wa_wali}
                    onChange={(e) => setFormData({...formData, no_wa_wali: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nama Dosen Pembimbing *</label>
                  <input
                    type="text"
                    value={formData.nama_dosen_pembimbing}
                    onChange={(e) => setFormData({...formData, nama_dosen_pembimbing: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">No. WA Dosen Pembimbing *</label>
                  <input
                    type="tel"
                    value={formData.no_wa_dosen_pembimbing}
                    onChange={(e) => setFormData({...formData, no_wa_dosen_pembimbing: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedStudent(null);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors duration-150"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50 flex items-center justify-center"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Perbarui
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clustering History Modal */}
      {showHistoryModal && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Riwayat Clustering - {selectedStudent.nama}
              </h3>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedStudent(null);
                  setClusteringHistory([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {clusteringHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Belum ada riwayat clustering untuk mahasiswa ini
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Periode</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Alpa</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">JP</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kedisiplinan</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cluster</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {clusteringHistory.map((result, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {result.batch?.periode?.nama_periode || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {result.batch?.nama_batch || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.total_a}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.jp}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            result.kedisiplinan === 'Disiplin' 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {result.kedisiplinan}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          Cluster {result.cluster}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(result.created_at).toLocaleDateString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}