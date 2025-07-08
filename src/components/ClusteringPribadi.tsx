import React, { useState, useEffect } from 'react';
import { User, BarChart3, TrendingUp, AlertTriangle } from 'lucide-react';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default function ClusteringPribadi() {
  const [clusteringData, setClusteringData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const user = getCurrentUser();

  // Debug logging
  useEffect(() => {
    console.log('ClusteringPribadi - user from getCurrentUser:', user);
  }, []);
  useEffect(() => {
    if (user) {
      console.log('ClusteringPribadi - loading data for user:', user.id);
      loadPersonalClustering();
    } else {
      console.log('ClusteringPribadi - no user found');
      setLoading(false);
    }
  }, [user]);

  const loadPersonalClustering = async () => {
    if (!user) return;

    try {
      console.log('Loading clustering data for user:', user.id);
      const { data, error } = await supabase
        .from('hasil_clustering')
        .select(`
          *,
          batch:batch(*, periode:periode(*))
        `)
        .eq('id_user', user.id)
        .order('id', { ascending: false });

      if (error) throw error;

      console.log('Clustering data loaded:', data);
      setClusteringData(data || []);
    } catch (error) {
      console.error('Error loading personal clustering:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (kedisiplinan: string) => {
    switch (kedisiplinan) {
      case 'Disiplin':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'SP-I':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'SP-II':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'SP-III':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getClusterColor = (cluster: string) => {
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-purple-100 text-purple-800',
      'bg-pink-100 text-pink-800',
      'bg-indigo-100 text-indigo-800',
      'bg-teal-100 text-teal-800'
    ];
    const index = parseInt(cluster) % colors.length;
    return colors[index] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Akses Ditolak</h3>
          <p className="text-gray-600">Anda harus login terlebih dahulu untuk melihat data clustering.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Hasil Clustering Pribadi</h1>
        <div className="flex items-center text-gray-600">
          <User className="w-5 h-5 mr-2" />
          {user?.nama || user?.nim || 'Mahasiswa'}
        </div>
      </div>

      {clusteringData.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-200 text-center">
          <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Belum Ada Data Clustering</h3>
          <div className="text-gray-600 space-y-2">
            <p>Data clustering Anda belum tersedia.</p>
            <p className="text-sm">Silakan hubungi admin untuk informasi lebih lanjut atau tunggu hingga proses clustering dilakukan.</p>
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Info:</strong> Data clustering akan muncul setelah admin melakukan proses clustering pada data presensi Anda.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Periode</p>
                  <p className="text-2xl font-bold text-gray-900">{clusteringData.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Status Terkini</p>
                  <p className="text-lg font-bold text-gray-900">{clusteringData[0]?.kedisiplinan || '-'}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Cluster Terkini</p>
                  <p className="text-lg font-bold text-gray-900">Cluster {clusteringData[0]?.cluster || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Clustering History */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Riwayat Clustering</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {clusteringData.map((result, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                    onClick={() => setSelectedResult(selectedResult?.id === result.id ? null : result)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-2">
                          <h4 className="font-medium text-gray-900">
                            {result.batch?.periode?.nama_periode || 'Periode Tidak Diketahui'}
                          </h4>
                          <span className="text-sm text-gray-500">
                            {result.batch?.nama_batch || 'Batch Tidak Diketahui'}
                          </span>
                          <span className="text-sm text-gray-500">
                            {result.tingkat} - {result.kelas}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(result.kedisiplinan)}`}>
                            {result.kedisiplinan}
                          </span>
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getClusterColor(result.cluster)}`}>
                            Cluster {result.cluster}
                          </span>
                          <span className="text-sm text-gray-600">
                            Total Alpa: {result.total_a}
                          </span>
                          <span className="text-sm text-gray-600">
                            JP: {result.jp}
                          </span>
                        </div>
                      </div>
                      <div className="text-gray-400">
                        {selectedResult?.id === result.id ? '−' : '+'}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {selectedResult?.id === result.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Statistics */}
                          <div>
                            <h5 className="font-medium text-gray-900 mb-3">Statistik Kehadiran</h5>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Total Ketidakhadiran:</span>
                                <span className="text-sm font-medium text-gray-900">{result.total_a}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Jumlah Pertemuan:</span>
                                <span className="text-sm font-medium text-gray-900">{result.jp}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Persentase Kehadiran:</span>
                                <span className="text-sm font-medium text-gray-900">
                                  {result.jp > 0 ? (((result.jp - result.total_a) / result.jp) * 100).toFixed(1) : 0}%
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Subject Details */}
                          {result.nilai_matkul && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-3">Detail Mata Kuliah</h5>
                              <div className="space-y-1 max-h-40 overflow-y-auto">
                                {Object.entries(result.nilai_matkul)
                                  .filter(([key]) => key.endsWith('_A'))
                                  .map(([subject, absences]: [string, any]) => (
                                    <div key={subject} className="flex justify-between text-sm">
                                      <span className="text-gray-600">{subject.replace('_A', '')}:</span>
                                      <span className={`font-medium ${absences > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {absences} alpa
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Insight */}
                        <div className="mt-4">
                          <h5 className="font-medium text-gray-900 mb-2">Analisis & Rekomendasi</h5>
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <p className="text-sm text-gray-700 leading-relaxed">
                              {result.insight}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}