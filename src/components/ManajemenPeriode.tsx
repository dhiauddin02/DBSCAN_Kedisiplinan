import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Calendar, Layers, Save, X, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Periode {
  id: string;
  nama_periode: string;
  semester?: string;
  is_active: boolean;
  created_at: string;
}

interface Batch {
  id: string;
  nama_batch: string;
  tgl_batch: string;
  id_periode: string;
  status: string;
  semester?: string;
  created_at: string;
  periode?: Periode;
}

export default function ManajemenPeriode() {
  const [periods, setPeriods] = useState<Periode[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Modal states
  const [showAddPeriodModal, setShowAddPeriodModal] = useState(false);
  const [showEditPeriodModal, setShowEditPeriodModal] = useState(false);
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [showEditBatchModal, setShowEditBatchModal] = useState(false);
  
  // Form states
  const [selectedPeriod, setSelectedPeriod] = useState<Periode | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [newPeriod, setNewPeriod] = useState({ nama_periode: '', semester: '', is_active: false });
  const [newBatch, setNewBatch] = useState({ nama_batch: '', tgl_batch: '', id_periode: '', semester: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load periods
      const { data: periodsData, error: periodsError } = await supabase
        .from('periode')
        .select('*')
        .order('created_at', { ascending: false });

      if (periodsError) throw periodsError;

      // Load batches with periode data
      const { data: batchesData, error: batchesError } = await supabase
        .from('batch')
        .select(`
          *,
          periode:periode(*)
        `)
        .order('created_at', { ascending: false });

      if (batchesError) throw batchesError;

      setPeriods(periodsData || []);
      setBatches(batchesData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Gagal memuat data' });
    } finally {
      setLoading(false);
    }
  };

  // Periode functions
  const handleAddPeriod = async () => {
    if (!newPeriod.nama_periode.trim()) {
      setMessage({ type: 'error', text: 'Nama periode harus diisi' });
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('periode')
        .insert({
          nama_periode: newPeriod.nama_periode.trim(),
          semester: newPeriod.semester.trim() || null,
          is_active: newPeriod.is_active
        });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Periode berhasil ditambahkan' });
      setShowAddPeriodModal(false);
      setNewPeriod({ nama_periode: '', semester: '', is_active: false });
      loadData();
    } catch (error) {
      console.error('Error adding period:', error);
      setMessage({ type: 'error', text: 'Gagal menambahkan periode' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditPeriod = async () => {
    if (!selectedPeriod || !newPeriod.nama_periode.trim()) {
      setMessage({ type: 'error', text: 'Nama periode harus diisi' });
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('periode')
        .update({
          nama_periode: newPeriod.nama_periode.trim(),
          semester: newPeriod.semester.trim() || null,
          is_active: newPeriod.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedPeriod.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Periode berhasil diperbarui' });
      setShowEditPeriodModal(false);
      setSelectedPeriod(null);
      setNewPeriod({ nama_periode: '', semester: '', is_active: false });
      loadData();
    } catch (error) {
      console.error('Error updating period:', error);
      setMessage({ type: 'error', text: 'Gagal memperbarui periode' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePeriod = async (period: Periode) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus periode "${period.nama_periode}"? Semua batch dalam periode ini juga akan terhapus.`)) {
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('periode')
        .delete()
        .eq('id', period.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Periode berhasil dihapus' });
      loadData();
    } catch (error) {
      console.error('Error deleting period:', error);
      setMessage({ type: 'error', text: 'Gagal menghapus periode' });
    } finally {
      setLoading(false);
    }
  };

  // Batch functions
  const handleAddBatch = async () => {
    if (!newBatch.nama_batch.trim() || !newBatch.id_periode || !newBatch.tgl_batch) {
      setMessage({ type: 'error', text: 'Semua field wajib harus diisi' });
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('batch')
        .insert({
          nama_batch: newBatch.nama_batch.trim(),
          tgl_batch: newBatch.tgl_batch,
          id_periode: newBatch.id_periode,
          semester: newBatch.semester.trim() || null,
          status: 'draft'
        });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Batch berhasil ditambahkan' });
      setShowAddBatchModal(false);
      setNewBatch({ nama_batch: '', tgl_batch: '', id_periode: '', semester: '' });
      loadData();
    } catch (error) {
      console.error('Error adding batch:', error);
      setMessage({ type: 'error', text: 'Gagal menambahkan batch' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditBatch = async () => {
    if (!selectedBatch || !newBatch.nama_batch.trim() || !newBatch.tgl_batch) {
      setMessage({ type: 'error', text: 'Nama batch dan tanggal harus diisi' });
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('batch')
        .update({
          nama_batch: newBatch.nama_batch.trim(),
          tgl_batch: newBatch.tgl_batch,
          semester: newBatch.semester.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedBatch.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Batch berhasil diperbarui' });
      setShowEditBatchModal(false);
      setSelectedBatch(null);
      setNewBatch({ nama_batch: '', tgl_batch: '', id_periode: '', semester: '' });
      loadData();
    } catch (error) {
      console.error('Error updating batch:', error);
      setMessage({ type: 'error', text: 'Gagal memperbarui batch' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBatch = async (batch: Batch) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus batch "${batch.nama_batch}"? Semua hasil clustering dalam batch ini juga akan terhapus.`)) {
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('batch')
        .delete()
        .eq('id', batch.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Batch berhasil dihapus' });
      loadData();
    } catch (error) {
      console.error('Error deleting batch:', error);
      setMessage({ type: 'error', text: 'Gagal menghapus batch' });
    } finally {
      setLoading(false);
    }
  };

  const openEditPeriodModal = (period: Periode) => {
    setSelectedPeriod(period);
    setNewPeriod({
      nama_periode: period.nama_periode,
      semester: period.semester || '',
      is_active: period.is_active
    });
    setShowEditPeriodModal(true);
  };

  const openEditBatchModal = (batch: Batch) => {
    setSelectedBatch(batch);
    setNewBatch({
      nama_batch: batch.nama_batch,
      tgl_batch: batch.tgl_batch,
      id_periode: batch.id_periode,
      semester: batch.semester || ''
    });
    setShowEditBatchModal(true);
  };

  const resetForms = () => {
    setNewPeriod({ nama_periode: '', semester: '', is_active: false });
    setNewBatch({ nama_batch: '', tgl_batch: '', id_periode: '', semester: '' });
    setSelectedPeriod(null);
    setSelectedBatch(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Manajemen Periode & Batch</h1>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center">
            {message.type === 'success' ? <CheckCircle className="w-5 h-5 mr-2" /> : <AlertCircle className="w-5 h-5 mr-2" />}
            {message.text}
          </div>
        </div>
      )}

      {/* Periode Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Calendar className="w-6 h-6 text-blue-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Periode Akademik</h2>
            </div>
            <button
              onClick={() => setShowAddPeriodModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors duration-150 flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Tambah Periode
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Periode</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Semester</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal Dibuat</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {periods.map((period) => (
                <tr key={period.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {period.nama_periode}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {period.semester || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      period.is_active 
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {period.is_active ? 'Aktif' : 'Tidak Aktif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(period.created_at).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openEditPeriodModal(period)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                        title="Edit Periode"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePeriod(period)}
                        className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                        title="Hapus Periode"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {periods.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Belum ada periode yang dibuat
            </div>
          )}
        </div>
      </div>

      {/* Batch Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Layers className="w-6 h-6 text-green-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Batch Clustering</h2>
            </div>
            <button
              onClick={() => setShowAddBatchModal(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors duration-150 flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Tambah Batch
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Batch</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Periode</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal Batch</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Semester</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {batches.map((batch) => (
                <tr key={batch.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {batch.nama_batch}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {batch.periode?.nama_periode || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(batch.tgl_batch).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {batch.semester || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      batch.status === 'completed' ? 'bg-green-100 text-green-800' :
                      batch.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {batch.status === 'completed' ? 'Selesai' :
                       batch.status === 'processing' ? 'Proses' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openEditBatchModal(batch)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                        title="Edit Batch"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBatch(batch)}
                        className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                        title="Hapus Batch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {batches.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Belum ada batch yang dibuat
            </div>
          )}
        </div>
      </div>

      {/* Add Period Modal */}
      {showAddPeriodModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Tambah Periode</h3>
              <button
                onClick={() => {
                  setShowAddPeriodModal(false);
                  resetForms();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nama Periode *</label>
                <input
                  type="text"
                  value={newPeriod.nama_periode}
                  onChange={(e) => setNewPeriod({...newPeriod, nama_periode: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="contoh: Ganjil 2024/2025"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
                <input
                  type="text"
                  value={newPeriod.semester}
                  onChange={(e) => setNewPeriod({...newPeriod, semester: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="contoh: Ganjil"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={newPeriod.is_active}
                  onChange={(e) => setNewPeriod({...newPeriod, is_active: e.target.checked})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                  Periode Aktif
                </label>
              </div>
            </div>

            <div className="flex space-x-4 mt-6">
              <button
                onClick={() => {
                  setShowAddPeriodModal(false);
                  resetForms();
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors duration-150"
              >
                Batal
              </button>
              <button
                onClick={handleAddPeriod}
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
          </div>
        </div>
      )}

      {/* Edit Period Modal */}
      {showEditPeriodModal && selectedPeriod && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Periode</h3>
              <button
                onClick={() => {
                  setShowEditPeriodModal(false);
                  resetForms();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nama Periode *</label>
                <input
                  type="text"
                  value={newPeriod.nama_periode}
                  onChange={(e) => setNewPeriod({...newPeriod, nama_periode: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="contoh: Ganjil 2024/2025"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
                <input
                  type="text"
                  value={newPeriod.semester}
                  onChange={(e) => setNewPeriod({...newPeriod, semester: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="contoh: Ganjil"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="edit_is_active"
                  checked={newPeriod.is_active}
                  onChange={(e) => setNewPeriod({...newPeriod, is_active: e.target.checked})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="edit_is_active" className="ml-2 block text-sm text-gray-900">
                  Periode Aktif
                </label>
              </div>
            </div>

            <div className="flex space-x-4 mt-6">
              <button
                onClick={() => {
                  setShowEditPeriodModal(false);
                  resetForms();
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors duration-150"
              >
                Batal
              </button>
              <button
                onClick={handleEditPeriod}
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
          </div>
        </div>
      )}

      {/* Add Batch Modal */}
      {showAddBatchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Tambah Batch</h3>
              <button
                onClick={() => {
                  setShowAddBatchModal(false);
                  resetForms();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Periode *</label>
                <select
                  value={newBatch.id_periode}
                  onChange={(e) => setNewBatch({...newBatch, id_periode: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Pilih Periode</option>
                  {periods.map(period => (
                    <option key={period.id} value={period.id}>
                      {period.nama_periode}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nama Batch *</label>
                <input
                  type="text"
                  value={newBatch.nama_batch}
                  onChange={(e) => setNewBatch({...newBatch, nama_batch: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="contoh: Batch 1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal Batch *</label>
                <input
                  type="date"
                  value={newBatch.tgl_batch}
                  onChange={(e) => setNewBatch({...newBatch, tgl_batch: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
                <input
                  type="text"
                  value={newBatch.semester}
                  onChange={(e) => setNewBatch({...newBatch, semester: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="contoh: Ganjil"
                />
              </div>
            </div>

            <div className="flex space-x-4 mt-6">
              <button
                onClick={() => {
                  setShowAddBatchModal(false);
                  resetForms();
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors duration-150"
              >
                Batal
              </button>
              <button
                onClick={handleAddBatch}
                disabled={loading}
                className="flex-1 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors duration-150 disabled:opacity-50 flex items-center justify-center"
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
          </div>
        </div>
      )}

      {/* Edit Batch Modal */}
      {showEditBatchModal && selectedBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Batch</h3>
              <button
                onClick={() => {
                  setShowEditBatchModal(false);
                  resetForms();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Periode</label>
                <input
                  type="text"
                  value={selectedBatch.periode?.nama_periode || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">Periode tidak dapat diubah</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nama Batch *</label>
                <input
                  type="text"
                  value={newBatch.nama_batch}
                  onChange={(e) => setNewBatch({...newBatch, nama_batch: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="contoh: Batch 1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal Batch *</label>
                <input
                  type="date"
                  value={newBatch.tgl_batch}
                  onChange={(e) => setNewBatch({...newBatch, tgl_batch: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
                <input
                  type="text"
                  value={newBatch.semester}
                  onChange={(e) => setNewBatch({...newBatch, semester: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="contoh: Ganjil"
                />
              </div>
            </div>

            <div className="flex space-x-4 mt-6">
              <button
                onClick={() => {
                  setShowEditBatchModal(false);
                  resetForms();
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors duration-150"
              >
                Batal
              </button>
              <button
                onClick={handleEditBatch}
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
          </div>
        </div>
      )}
    </div>
  );
}