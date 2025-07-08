import React, { useState, useEffect } from 'react';
import { Download, FileText, BarChart3, TrendingUp, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fontteAPI } from '../lib/api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Laporan() {
  const [periods, setPeriods] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [clusteringData, setClusteringData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadPeriodsAndBatches();
  }, []);

  const loadPeriodsAndBatches = async () => {
    try {
      const { data: periodsData } = await supabase.from('periode').select('*');
      const { data: batchesData } = await supabase.from('batch').select('*, periode:periode(*)');
      
      setPeriods(periodsData || []);
      setBatches(batchesData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const loadClusteringData = async () => {
    if (!selectedBatch) {
      setMessage({ type: 'error', text: 'Pilih batch terlebih dahulu' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hasil_clustering')
        .select(`
          *,
          user:users(*),
          batch:batch(*, periode:periode(*))
        `)
        .eq('id_batch', selectedBatch);

      if (error) throw error;

      setClusteringData(data || []);
      setMessage({ type: 'success', text: 'Data berhasil dimuat' });
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Gagal memuat data' });
    } finally {
      setLoading(false);
    }
  };

  const generateReport = () => {
    if (clusteringData.length === 0) return null;

    const stats = {
      total: clusteringData.length,
      disiplin: clusteringData.filter(d => d.kedisiplinan === 'Disiplin').length,
      sp1: clusteringData.filter(d => d.kedisiplinan === 'SP-I').length,
      sp2: clusteringData.filter(d => d.kedisiplinan === 'SP-II').length,
      sp3: clusteringData.filter(d => d.kedisiplinan === 'SP-III').length,
    };

    const clusters = [...new Set(clusteringData.map(d => d.cluster))];
    const batchInfo = clusteringData[0]?.batch;

    return {
      batchInfo,
      stats,
      clusters,
      data: clusteringData
    };
  };

  const exportToExcel = () => {
    if (clusteringData.length === 0) {
      setMessage({ type: 'error', text: 'Tidak ada data untuk diekspor' });
      return;
    }

    try {
      const report = generateReport();
      if (!report) return;

      // Prepare data for Excel
      const excelData = clusteringData.map((result, index) => ({
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
        { wch: 15 }   // Tanggal
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Laporan Clustering');

      // Generate filename
      const filename = `Laporan_Clustering_${report.batchInfo.nama_batch}_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);

      setMessage({ type: 'success', text: 'Laporan berhasil diekspor ke Excel!' });
      setShowExportModal(false);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      setMessage({ type: 'error', text: 'Gagal mengekspor ke Excel' });
    }
  };

  const exportToPDF = () => {
    if (clusteringData.length === 0) {
      setMessage({ type: 'error', text: 'Tidak ada data untuk diekspor' });
      return;
    }

    try {
      const report = generateReport();
      if (!report) return;

      const doc = new jsPDF('landscape', 'mm', 'a4');
      
      // Add title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('LAPORAN CLUSTERING KEDISIPLINAN MAHASISWA', 148, 20, { align: 'center' });
      
      // Add batch info
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Periode: ${report.batchInfo.periode.nama_periode}`, 20, 35);
      doc.text(`Batch: ${report.batchInfo.nama_batch}`, 20, 42);
      doc.text(`Tanggal: ${new Date(report.batchInfo.tgl_batch).toLocaleDateString('id-ID')}`, 20, 49);
      doc.text(`Total Mahasiswa: ${clusteringData.length}`, 20, 56);

      // Add statistics
      doc.text(`Statistik:`, 20, 70);
      doc.text(`- Disiplin: ${report.stats.disiplin} (${((report.stats.disiplin/report.stats.total)*100).toFixed(1)}%)`, 25, 77);
      doc.text(`- SP-I: ${report.stats.sp1} (${((report.stats.sp1/report.stats.total)*100).toFixed(1)}%)`, 25, 84);
      doc.text(`- SP-II: ${report.stats.sp2} (${((report.stats.sp2/report.stats.total)*100).toFixed(1)}%)`, 25, 91);
      doc.text(`- SP-III: ${report.stats.sp3} (${((report.stats.sp3/report.stats.total)*100).toFixed(1)}%)`, 25, 98);

      // Prepare table data
      const tableData = clusteringData.map((result, index) => [
        index + 1,
        result.user?.nim || result.nim,
        (result.user?.nama || result.nama_mahasiswa).substring(0, 20), // Limit name length
        result.tingkat,
        result.kelas,
        result.total_a,
        result.jp,
        result.jp > 0 ? (((result.jp - result.total_a) / result.jp) * 100).toFixed(1) + '%' : '0%',
        result.kedisiplinan,
        `Cluster ${result.cluster}`
      ]);

      // Add table using autoTable
      autoTable(doc, {
        head: [['No', 'NIM', 'Nama', 'Tingkat', 'Kelas', 'Alpa', 'JP', 'Kehadiran', 'Kedisiplinan', 'Cluster']],
        body: tableData,
        startY: 110,
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
          9: { halign: 'center', cellWidth: 18 }   // Cluster
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
      const filename = `Laporan_Clustering_${report.batchInfo.nama_batch}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);

      setMessage({ type: 'success', text: 'Laporan berhasil diekspor ke PDF!' });
      setShowExportModal(false);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      setMessage({ type: 'error', text: 'Gagal mengekspor ke PDF' });
    }
  };

  const sendReportViaWhatsApp = async () => {
    const report = generateReport();
    if (!report) {
      setMessage({ type: 'error', text: 'Tidak ada data untuk dikirim' });
      return;
    }

    const fontteToken = import.meta.env.VITE_FONNTE_TOKEN;
    if (!fontteToken) {
      setMessage({ type: 'error', text: 'Token Fonnte belum dikonfigurasi untuk pengiriman WhatsApp' });
      return;
    }

    setLoading(true);
    try {
      // Send report to all parents and supervisors
      let successCount = 0;
      
      for (const result of clusteringData) {
        const reportMessage = generateReportMessage(result, report);
        
        // Send to parent
        if (result.user?.no_wa_wali) {
          try {
            await fontteAPI.sendWhatsApp(result.user.no_wa_wali, reportMessage);
            successCount++;
          } catch (error) {
            console.error('Error sending to parent:', error);
          }
        }

        // Send to supervisor
        if (result.user?.no_wa_dosen_pembimbing) {
          try {
            await fontteAPI.sendWhatsApp(result.user.no_wa_dosen_pembimbing, reportMessage);
            successCount++;
          } catch (error) {
            console.error('Error sending to supervisor:', error);
          }
        }
      }

      setMessage({ type: 'success', text: `Laporan berhasil dikirim ke ${successCount} kontak via WhatsApp` });
    } catch (error) {
      console.error('Error sending report via WhatsApp:', error);
      setMessage({ type: 'error', text: 'Gagal mengirim laporan via WhatsApp' });
    } finally {
      setLoading(false);
    }
  };

  const generateReportMessage = (result: any, report: any) => {
    return `LAPORAN CLUSTERING KEDISIPLINAN MAHASISWA

Periode: ${report.batchInfo.periode.nama_periode}
Batch: ${report.batchInfo.nama_batch}

DATA MAHASISWA:
Nama: ${result.user?.nama || result.nama_mahasiswa}
NIM: ${result.user?.nim || result.nim}
Tingkat/Kelas: ${result.tingkat}/${result.kelas}
Total Ketidakhadiran: ${result.total_a}
Status Kedisiplinan: ${result.kedisiplinan}
Cluster: ${result.cluster}

RINGKASAN BATCH:
Total Mahasiswa: ${report.stats.total}
- Disiplin: ${report.stats.disiplin} (${((report.stats.disiplin/report.stats.total)*100).toFixed(1)}%)
- SP-I: ${report.stats.sp1} (${((report.stats.sp1/report.stats.total)*100).toFixed(1)}%)
- SP-II: ${report.stats.sp2} (${((report.stats.sp2/report.stats.total)*100).toFixed(1)}%)
- SP-III: ${report.stats.sp3} (${((report.stats.sp3/report.stats.total)*100).toFixed(1)}%)

Insight: ${result.insight}

Politeknik Negeri Lhokseumawe
Bagian Akademik`;
  };

  const report = generateReport();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Laporan Clustering</h1>
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

      {/* Filters */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Periode</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Batch</label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Pilih Batch</option>
              {batches
                .filter(batch => !selectedPeriod || batch.id_periode === selectedPeriod)
                .map(batch => (
                <option key={batch.id} value={batch.id}>
                  {batch.nama_batch}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={loadClusteringData}
              disabled={!selectedBatch || loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Memuat...' : 'Muat Data'}
            </button>
          </div>
        </div>
      </div>

      {/* Report Summary */}
      {report && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Mahasiswa</p>
                  <p className="text-2xl font-bold text-gray-900">{report.stats.total}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Disiplin</p>
                  <p className="text-2xl font-bold text-gray-900">{report.stats.disiplin}</p>
                  <p className="text-xs text-gray-500">{((report.stats.disiplin/report.stats.total)*100).toFixed(1)}%</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Peringatan</p>
                  <p className="text-2xl font-bold text-gray-900">{report.stats.sp1 + report.stats.sp2 + report.stats.sp3}</p>
                  <p className="text-xs text-gray-500">{(((report.stats.sp1 + report.stats.sp2 + report.stats.sp3)/report.stats.total)*100).toFixed(1)}%</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Cluster</p>
                  <p className="text-2xl font-bold text-gray-900">{report.clusters.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Report */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Laporan Detail</h3>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowExportModal(true)}
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50 flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Laporan
                </button>
                
                <button
                  onClick={sendReportViaWhatsApp}
                  disabled={loading}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors duration-150 disabled:opacity-50 flex items-center"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {loading ? 'Mengirim...' : 'Kirim via WhatsApp'}
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {/* Batch Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">Informasi Batch</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Periode:</span>
                    <span className="ml-2 font-medium">{report.batchInfo.periode.nama_periode}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Batch:</span>
                    <span className="ml-2 font-medium">{report.batchInfo.nama_batch}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Tanggal:</span>
                    <span className="ml-2 font-medium">{new Date(report.batchInfo.tgl_batch).toLocaleDateString('id-ID')}</span>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Distribusi Kedisiplinan</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span className="text-green-800">Disiplin</span>
                      <span className="font-medium text-green-800">{report.stats.disiplin} ({((report.stats.disiplin/report.stats.total)*100).toFixed(1)}%)</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                      <span className="text-yellow-800">SP-I</span>
                      <span className="font-medium text-yellow-800">{report.stats.sp1} ({((report.stats.sp1/report.stats.total)*100).toFixed(1)}%)</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-orange-50 rounded">
                      <span className="text-orange-800">SP-II</span>
                      <span className="font-medium text-orange-800">{report.stats.sp2} ({((report.stats.sp2/report.stats.total)*100).toFixed(1)}%)</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-red-50 rounded">
                      <span className="text-red-800">SP-III</span>
                      <span className="font-medium text-red-800">{report.stats.sp3} ({((report.stats.sp3/report.stats.total)*100).toFixed(1)}%)</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Distribusi Cluster</h4>
                  <div className="space-y-2">
                    {report.clusters.map(cluster => {
                      const count = clusteringData.filter(d => d.cluster === cluster).length;
                      return (
                        <div key={cluster} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <span className="text-gray-800">Cluster {cluster}</span>
                          <span className="font-medium text-gray-800">{count} ({((count/report.stats.total)*100).toFixed(1)}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Data Lengkap Mahasiswa</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mahasiswa</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tingkat/Kelas</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Alpa</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">JP</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kedisiplinan</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cluster</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {clusteringData.map((result, index) => (
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pilih Format Export</h3>
            <p className="text-gray-600 mb-6">
              Pilih format file untuk mengekspor laporan clustering dalam bentuk tabel.
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