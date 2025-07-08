import React, { useState, useEffect } from 'react';
import { Eye, Send, Download, Calendar, Layers, ChevronDown, ChevronRight, FileSpreadsheet, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fontteAPI } from '../lib/api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function HasilClustering() {
  const [periods, setPeriods] = useState<any[]>([]);
  const [batchesWithResultsStatus, setBatchesWithResultsStatus] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedBatchForModal, setSelectedBatchForModal] = useState<any | null>(null);
  const [clusteringResultsInModal, setClusteringResultsInModal] = useState<any[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadPeriodsAndBatches();
  }, []);

  const loadPeriodsAndBatches = async () => {
    try {
      const { data: periodsData } = await supabase.from('periode').select('*').order('created_at', { ascending: false });
      const { data: batchesData } = await supabase.from('batch').select('*, periode:periode(*)').order('created_at', { ascending: false });
      
      setPeriods(periodsData || []);

      // Check clustering results for each batch
      if (batchesData) {
        const batchesWithStatus = await Promise.all(
          batchesData.map(async (batch: any) => {
            const { count } = await supabase
              .from('hasil_clustering')
              .select('*', { count: 'exact', head: true })
              .eq('id_batch', batch.id);
            
            // Check if all results have been sent
            const { data: sentResults } = await supabase
              .from('hasil_clustering')
              .select('status_pesan')
              .eq('id_batch', batch.id);
            
            const allSent = sentResults && sentResults.length > 0 && 
              sentResults.every(r => r.status_pesan === 'terkirim');
            
            return { 
              ...batch, 
              hasResults: (count || 0) > 0,
              allMessagesSent: allSent,
              resultCount: count || 0
            };
          })
        );
        setBatchesWithResultsStatus(batchesWithStatus);
      }
    } catch (error) {
      console.error('Error loading periods and batches:', error);
    }
  };

  const togglePeriodExpansion = (periodId: string) => {
    const newExpanded = new Set(expandedPeriods);
    if (newExpanded.has(periodId)) {
      newExpanded.delete(periodId);
    } else {
      newExpanded.add(periodId);
    }
    setExpandedPeriods(newExpanded);
  };

  const handleViewResults = async (batch: any) => {
    setLoadingResults(true);
    setSelectedBatchForModal(batch);
    
    try {
      const { data, error } = await supabase
        .from('hasil_clustering')
        .select(`
          *,
          user:users(*),
          batch:batch(*, periode:periode(*))
        `)
        .eq('id_batch', batch.id);

      if (error) throw error;

      setClusteringResultsInModal(data || []);
      setShowResultsModal(true);
    } catch (error) {
      console.error('Error loading results:', error);
      setMessage({ type: 'error', text: 'Gagal memuat hasil clustering' });
    } finally {
      setLoadingResults(false);
    }
  };

  const exportToExcel = () => {
    if (clusteringResultsInModal.length === 0) {
      setMessage({ type: 'error', text: 'Tidak ada data untuk diekspor' });
      return;
    }

    try {
      // Prepare data for Excel
      const excelData = clusteringResultsInModal.map((result, index) => ({
        'No': index + 1,
        'NIM': result.user?.nim || result.nim,
        'Nama Mahasiswa': result.user?.nama || result.nama_mahasiswa,
        'Tingkat': result.tingkat,
        'Kelas': result.kelas,
        'Total Alpa': result.total_a,
        'Jumlah Pertemuan (JP)': result.jp,
        'Persentase Kehadiran (%)': result.jp > 0 ? (((result.jp - result.total_a) / result.jp) * 100).toFixed(1) : '0',
        'Status Kedisiplinan': result.kedisiplinan,
        'Cluster': `Cluster ${result.cluster}`,
        'Insight': result.insight,
        'Status Pesan': result.status_pesan,
        'Tanggal Clustering': new Date(result.created_at).toLocaleDateString('id-ID')
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const colWidths = [
        { wch: 5 },   // No
        { wch: 15 },  // NIM
        { wch: 25 },  // Nama
        { wch: 10 },  // Tingkat
        { wch: 10 },  // Kelas
        { wch: 12 },  // Total Alpa
        { wch: 15 },  // JP
        { wch: 18 },  // Persentase
        { wch: 15 },  // Kedisiplinan
        { wch: 12 },  // Cluster
        { wch: 50 },  // Insight
        { wch: 15 },  // Status Pesan
        { wch: 15 }   // Tanggal
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Hasil Clustering');

      // Generate filename
      const filename = `Hasil_Clustering_${selectedBatchForModal?.nama_batch}_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);

      setMessage({ type: 'success', text: 'Data berhasil diekspor ke Excel!' });
      setShowExportModal(false);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      setMessage({ type: 'error', text: 'Gagal mengekspor ke Excel' });
    }
  };

  const exportToPDF = () => {
    if (clusteringResultsInModal.length === 0) {
      setMessage({ type: 'error', text: 'Tidak ada data untuk diekspor' });
      return;
    }

    try {
      const doc = new jsPDF('landscape', 'mm', 'a4');
      
      // Add title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('LAPORAN HASIL CLUSTERING KEDISIPLINAN MAHASISWA', 148, 20, { align: 'center' });
      
      // Add batch info
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Periode: ${selectedBatchForModal?.periode?.nama_periode}`, 20, 35);
      doc.text(`Batch: ${selectedBatchForModal?.nama_batch}`, 20, 42);
      doc.text(`Tanggal: ${new Date(selectedBatchForModal?.tgl_batch).toLocaleDateString('id-ID')}`, 20, 49);
      doc.text(`Total Mahasiswa: ${clusteringResultsInModal.length}`, 20, 56);

      // Prepare table data
      const tableData = clusteringResultsInModal.map((result, index) => [
        index + 1,
        result.user?.nim || result.nim,
        (result.user?.nama || result.nama_mahasiswa).substring(0, 20), // Limit name length
        result.tingkat,
        result.kelas,
        result.total_a,
        result.jp,
        result.jp > 0 ? (((result.jp - result.total_a) / result.jp) * 100).toFixed(1) + '%' : '0%',
        result.kedisiplinan,
        `Cluster ${result.cluster}`,
        result.status_pesan
      ]);

      // Add table using autoTable
      autoTable(doc, {
        head: [['No', 'NIM', 'Nama', 'Tingkat', 'Kelas', 'Alpa', 'JP', 'Kehadiran', 'Kedisiplinan', 'Cluster', 'Status']],
        body: tableData,
        startY: 65,
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [66, 139, 202],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },  // No
          1: { halign: 'center', cellWidth: 20 },  // NIM
          2: { halign: 'left', cellWidth: 35 },    // Nama
          3: { halign: 'center', cellWidth: 15 },  // Tingkat
          4: { halign: 'center', cellWidth: 15 },  // Kelas
          5: { halign: 'center', cellWidth: 12 },  // Alpa
          6: { halign: 'center', cellWidth: 12 },  // JP
          7: { halign: 'center', cellWidth: 18 },  // Kehadiran
          8: { halign: 'center', cellWidth: 20 },  // Kedisiplinan
          9: { halign: 'center', cellWidth: 18 },  // Cluster
          10: { halign: 'center', cellWidth: 20 }  // Status
        }
      });

      // Add footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Halaman ${i} dari ${pageCount}`, 148, 200, { align: 'center' });
        doc.text(`Dibuat pada: ${new Date().toLocaleString('id-ID')}`, 20, 205);
        doc.text('Politeknik Negeri Lhokseumawe - Bagian Akademik', 220, 205);
      }

      // Generate filename and save
      const filename = `Hasil_Clustering_${selectedBatchForModal?.nama_batch}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);

      setMessage({ type: 'success', text: 'Data berhasil diekspor ke PDF!' });
      setShowExportModal(false);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      setMessage({ type: 'error', text: 'Gagal mengekspor ke PDF' });
    }
  };

  const generateMessage = (result: any) => {
    const periode = result.batch?.periode;
    return `Kepada Yth.
Sdr. ${result.user?.nama || result.nama_mahasiswa}
Mahasiswa ${result.tingkat}, Kelas ${result.kelas}
Politeknik Negeri Lhokseumawe
di Tempat

Dengan hormat,
Berdasarkan hasil evaluasi rekapitulasi absensi mahasiswa untuk Semester ${periode?.nama_periode}, bersama ini kami sampaikan informasi terkait kehadiran Anda sebagai berikut:

Keterangan	Nilai
Nama Mahasiswa	${result.user?.nama || result.nama_mahasiswa}
NIM	${result.user?.nim || result.nim}
Tingkat / Kelas	${result.tingkat} / ${result.kelas}
Total Ketidakhadiran	${result.total_a}
Jumlah Pertemuan (JP)	${result.jp}
Status Kedisiplinan	${result.kedisiplinan}
Keterangan Tambahan	${result.insight}

${result.kedisiplinan === 'Disiplin' 
  ? 'Kami mengapresiasi kedisiplinan Anda dalam mengikuti kegiatan perkuliahan. Semoga hal ini dapat menjadi motivasi bagi rekan-rekan mahasiswa lainnya. Harap dipertahankan dan terus ditingkatkan untuk semester berikutnya.'
  : 'Dengan ini kami menyampaikan status kedisiplinan Anda selama periode yang telah ditentukan. Harap informasi ini dapat menjadi perhatian dan bahan evaluasi untuk menjaga atau meningkatkan kedisiplinan ke depannya.'
}

Demikian surat pemberitahuan ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.

Hormat kami,
Bagian Akademik
Politeknik Negeri Lhokseumawe`;
  };

  const sendClusteringResults = async () => {
    if (clusteringResultsInModal.length === 0) {
      setMessage({ type: 'error', text: 'Tidak ada data untuk dikirim' });
      return;
    }

    const fontteToken = import.meta.env.VITE_FONNTE_TOKEN;
    if (!fontteToken) {
      setMessage({ type: 'error', text: 'Token Fonnte belum dikonfigurasi' });
      return;
    }

    setIsSendingWhatsApp(true);
    let successCount = 0;

    try {
      for (const result of clusteringResultsInModal) {
        const message = generateMessage(result);
        
        // Send to parent (wali)
        if (result.user?.no_wa_wali) {
          try {
            await fontteAPI.sendWhatsApp(result.user.no_wa_wali, message);
            successCount++;
          } catch (error) {
            console.error('Error sending to parent:', error);
          }
        }

        // Send to supervisor (dosen pembimbing)
        if (result.user?.no_wa_dosen_pembimbing) {
          try {
            await fontteAPI.sendWhatsApp(result.user.no_wa_dosen_pembimbing, message);
            successCount++;
          } catch (error) {
            console.error('Error sending to supervisor:', error);
          }
        }

        // Update status
        await supabase
          .from('hasil_clustering')
          .update({ status_pesan: 'terkirim' })
          .eq('id', result.id);
      }

      setMessage({ type: 'success', text: `Berhasil mengirim ${successCount} pesan WhatsApp` });
      
      // Reload results to update status
      await handleViewResults(selectedBatchForModal);
      // Reload batches to update status
      await loadPeriodsAndBatches();
    } catch (error) {
      console.error('Error sending messages:', error);
      setMessage({ type: 'error', text: 'Gagal mengirim pesan' });
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const filteredBatches = batchesWithResultsStatus.filter(batch => 
    !selectedPeriodId || batch.id_periode === selectedPeriodId
  );

  const groupedBatches = periods.reduce((acc, period) => {
    acc[period.id] = batchesWithResultsStatus.filter(batch => batch.id_periode === period.id);
    return acc;
  }, {} as Record<string, any[]>);

  // Filter periods based on selectedPeriodId
  const filteredPeriods = selectedPeriodId 
    ? periods.filter(period => period.id === selectedPeriodId)
    : periods;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Hasil Clustering</h1>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Filter */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Filter berdasarkan Periode (Opsional)</label>
          <select
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Semua Periode</option>
            {periods.map(period => (
              <option key={period.id} value={period.id}>
                {period.nama_periode}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700">
            <strong>Catatan:</strong> Untuk menambah periode atau batch baru, silakan kunjungi halaman <strong>Manajemen Periode</strong> di sidebar.
          </p>
        </div>
      </div>

      {/* Periods and Batches with Expandable Structure */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Daftar Periode dan Batch</h3>
        
        {periods.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Belum ada periode yang dibuat. Silakan tambah periode di halaman <strong>Manajemen Periode</strong>.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPeriods.map(period => {
              const periodBatches = groupedBatches[period.id] || [];
              const isExpanded = expandedPeriods.has(period.id);
              
              return (
                <div key={period.id} className="border border-gray-200 rounded-lg">
                  <div 
                    className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors duration-150 flex items-center justify-between"
                    onClick={() => togglePeriodExpansion(period.id)}
                  >
                    <div className="flex items-center">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-500 mr-2" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-500 mr-2" />
                      )}
                      <Calendar className="w-5 h-5 text-blue-600 mr-2" />
                      <div>
                        <h4 className="font-medium text-gray-900">{period.nama_periode}</h4>
                        {period.semester && (
                          <p className="text-sm text-gray-500">Semester: {period.semester}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {periodBatches.length} batch
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="p-4 border-t border-gray-200">
                      {periodBatches.length === 0 ? (
                        <div className="text-center py-4 text-gray-500">
                          Belum ada batch untuk periode ini
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {periodBatches.map(batch => (
                            <div key={batch.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-150">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="font-medium text-gray-900">{batch.nama_batch}</h5>
                                <Layers className="w-4 h-4 text-gray-400" />
                              </div>
                              <p className="text-sm text-gray-500 mb-2">
                                {new Date(batch.tgl_batch).toLocaleDateString('id-ID')}
                              </p>
                              
                              {batch.hasResults && (
                                <div className="mb-3">
                                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                    {batch.resultCount} hasil clustering
                                  </span>
                                  {batch.allMessagesSent && (
                                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 ml-2">
                                      Pesan terkirim
                                    </span>
                                  )}
                                </div>
                              )}
                              
                              <button
                                onClick={() => handleViewResults(batch)}
                                disabled={!batch.hasResults || loadingResults}
                                className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                {batch.hasResults ? 'Lihat Hasil Clustering' : 'Belum Ada Hasil'}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Results Modal */}
      {showResultsModal && selectedBatchForModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-7xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Hasil Clustering - {selectedBatchForModal.nama_batch}
                </h3>
                <p className="text-sm text-gray-600">
                  {selectedBatchForModal.periode?.nama_periode} | {new Date(selectedBatchForModal.tgl_batch).toLocaleDateString('id-ID')}
                </p>
              </div>
              <button
                onClick={() => setShowResultsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="overflow-x-auto mb-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mahasiswa</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tingkat/Kelas</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Alpa</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">JP</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kedisiplinan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cluster</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status Pesan</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {clusteringResultsInModal.map((result, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{result.user?.nama || result.nama_mahasiswa}</div>
                          <div className="text-sm text-gray-500">{result.user?.nim || result.nim}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {result.tingkat} / {result.kelas}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {result.total_a}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {result.jp}
                      </td>
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          result.status_pesan === 'terkirim' 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {result.status_pesan}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowExportModal(true)}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50 flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Laporan
              </button>
              
              <button
                onClick={sendClusteringResults}
                disabled={isSendingWhatsApp || clusteringResultsInModal.length === 0 || 
                  clusteringResultsInModal.every(r => r.status_pesan === 'terkirim')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-150 disabled:opacity-50 flex items-center"
              >
                {isSendingWhatsApp ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {clusteringResultsInModal.every(r => r.status_pesan === 'terkirim') 
                  ? 'Semua Pesan Terkirim' 
                  : 'Kirim WhatsApp'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pilih Format Export</h3>
            <p className="text-gray-600 mb-6">
              Pilih format file untuk mengekspor hasil clustering dalam bentuk tabel.
            </p>
            
            <div className="space-y-3">
              <button
                onClick={exportToExcel}
                className="w-full flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-150"
              >
                <FileSpreadsheet className="w-5 h-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Export ke Excel</div>
                  <div className="text-sm opacity-90">Format .xlsx dengan tabel lengkap</div>
                </div>
              </button>
              
              <button
                onClick={exportToPDF}
                className="w-full flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-150"
              >
                <FileText className="w-5 h-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Export ke PDF</div>
                  <div className="text-sm opacity-90">Format .pdf dengan tabel rapi</div>
                </div>
              </button>
            </div>

            <div className="flex space-x-4 mt-6">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors duration-150"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}