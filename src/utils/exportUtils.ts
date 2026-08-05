import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { IsothermAnalysisResults, KineticsAnalysisResults } from '../types';

export function exportToExcel(
  isothermRes: IsothermAnalysisResults | null,
  kineticsRes: KineticsAnalysisResults | null,
  params: { weightW: number; volumeV: number; temperatureT: number; tempUnit: string; fittingMode: string }
) {
  const wb = XLSX.utils.book_new();

  // 1. Experimental Conditions Sheet
  const metaData = [
    { المعامل: 'وزن المادة الممتزة W (g)', القيمة: params.weightW },
    { المعامل: 'حجم المحلول V (L)', القيمة: params.volumeV },
    { المعامل: `درجة حرارة التجربة (${params.tempUnit})`, القيمة: params.temperatureT },
    { المعامل: 'طريقة المعالجة (Fitting Mode)', القيمة: params.fittingMode === 'nonlinear' ? 'Direct Non-Linear Optimization' : 'Classical Linearization' },
  ];
  const wsMeta = XLSX.utils.json_to_sheet(metaData);
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Experimental Conditions');

  // 2. Isotherms Sheet (if available)
  if (isothermRes) {
    const isoData = isothermRes.rankedModels.map((m) => ({
      Model: m.nameEn,
      'Model (Arabic)': m.name,
      'R²': Number(m.r2.toFixed(4)),
      'Adjusted R²': Number(m.adjR2.toFixed(4)),
      RMSE: Number(m.rmse.toFixed(4)),
      MSE: Number(m.mse.toFixed(4)),
      SSE: Number(m.sse.toFixed(4)),
      MAE: Number(m.mae.toFixed(4)),
      'Chi-Square': Number(m.chiSquare.toFixed(4)),
      AIC: Number(m.aic.toFixed(2)),
      AICc: isNaN(m.aicc) ? 'N/A' : Number(m.aicc.toFixed(2)),
      BIC: Number(m.bic.toFixed(2)),
      Ranking: m.rank,
    }));
    const wsIso = XLSX.utils.json_to_sheet(isoData);
    XLSX.utils.book_append_sheet(wb, wsIso, 'Isotherms Comparison');

    const isoExp = isothermRes.Ce.map((ce, i) => ({
      'Point #': i + 1,
      'C0 (mg/L)': isothermRes.C0[i],
      'Ce (mg/L)': ce,
      'Qe (mg/g)': isothermRes.Qe[i],
    }));
    const wsIsoExp = XLSX.utils.json_to_sheet(isoExp);
    XLSX.utils.book_append_sheet(wb, wsIsoExp, 'Isotherms Raw Data');
  }

  // 3. Kinetics Sheet (if available)
  if (kineticsRes) {
    const kinData = kineticsRes.rankedModels.map((m) => {
      const paramStr = Object.entries(m.params)
        .map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(4) : v}`)
        .join('; ');
      return {
        Model: m.nameEn,
        'Model (Arabic)': m.name,
        Parameters: paramStr,
        'R²': Number(m.r2.toFixed(4)),
        'Adjusted R²': Number(m.adjR2.toFixed(4)),
        RMSE: Number(m.rmse.toFixed(4)),
        MAE: Number(m.mae.toFixed(4)),
        SSE: Number(m.sse.toFixed(4)),
        'Chi-Square': Number(m.chiSquare.toFixed(4)),
        AIC: Number(m.aic.toFixed(2)),
        BIC: Number(m.bic.toFixed(2)),
        Ranking: m.rank,
      };
    });
    const wsKin = XLSX.utils.json_to_sheet(kinData);
    XLSX.utils.book_append_sheet(wb, wsKin, 'Kinetics Comparison');

    const kinExp = kineticsRes.t.map((tv, i) => ({
      'Point #': i + 1,
      'Time t (min)': tv,
      'Ct (mg/L)': kineticsRes.Ct[i],
      'qt Exp (mg/g)': kineticsRes.qt[i],
      'qt PFO': Number(kineticsRes.models.pfo.pred[i].toFixed(4)),
      'qt PSO': Number(kineticsRes.models.pso.pred[i].toFixed(4)),
      'qt Elovich': Number(kineticsRes.models.elovich.pred[i].toFixed(4)),
      'qt Weber-Morris': Number(kineticsRes.models.weberMorris.pred[i].toFixed(4)),
      'qt Boyd': Number(kineticsRes.models.boyd.pred[i].toFixed(4)),
      'qt Film Diffusion': Number(kineticsRes.models.filmDiffusion.pred[i].toFixed(4)),
    }));
    const wsKinExp = XLSX.utils.json_to_sheet(kinExp);
    XLSX.utils.book_append_sheet(wb, wsKinExp, 'Kinetics Raw & Pred Data');
  }

  const filename = `Adsorption_Modeling_Results_${Date.now()}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function exportToCSV(
  isothermRes: IsothermAnalysisResults | null,
  kineticsRes: KineticsAnalysisResults | null
) {
  let csvContent = 'data:text/csv;charset=utf-8,';

  if (isothermRes) {
    csvContent += '--- ISOTHERMS MODELING RESULTS ---\n';
    csvContent += 'Model,R2,Adj_R2,RMSE,MAE,AIC,BIC,Rank\n';
    isothermRes.rankedModels.forEach((m) => {
      csvContent += `"${m.nameEn}",${m.r2.toFixed(4)},${m.adjR2.toFixed(4)},${m.rmse.toFixed(4)},${m.mae.toFixed(4)},${m.aic.toFixed(2)},${m.bic.toFixed(2)},${m.rank}\n`;
    });
    csvContent += '\n';
  }

  if (kineticsRes) {
    csvContent += '--- KINETICS MODELING RESULTS ---\n';
    csvContent += 'Model,Parameters,R2,Adj_R2,RMSE,MAE,AIC,BIC,Rank\n';
    kineticsRes.rankedModels.forEach((m) => {
      const pStr = Object.entries(m.params)
        .map(([k, v]) => `${k}:${v.toFixed(4)}`)
        .join(' | ');
      csvContent += `"${m.nameEn}","${pStr}",${m.r2.toFixed(4)},${m.adjR2.toFixed(4)},${m.rmse.toFixed(4)},${m.mae.toFixed(4)},${m.aic.toFixed(2)},${m.bic.toFixed(2)},${m.rank}\n`;
    });
  }

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Adsorption_Modeling_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToWord(
  isothermRes: IsothermAnalysisResults | null,
  kineticsRes: KineticsAnalysisResults | null,
  params: { weightW: number; volumeV: number; temperatureT: number; tempUnit: string }
) {
  let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head>
    <meta charset='utf-8'>
    <title>Adsorption Modeling Scientific Report</title>
    <style>
      body { font-family: Arial, sans-serif; direction: rtl; line-height: 1.6; padding: 20px; }
      h1 { color: #1e3a8a; text-align: center; }
      h2 { color: #0284c7; border-bottom: 2px solid #0284c7; padding-bottom: 4px; margin-top: 24px; }
      table { border-collapse: collapse; width: 100%; margin: 12px 0; }
      th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-size: 13px; }
      th { background-color: #f1f5f9; color: #1e293b; font-weight: bold; }
      .interpretation { background: #f8fafc; border-right: 4px solid #0284c7; padding: 12px; margin: 12px 0; border-radius: 4px; }
    </style>
  </head>
  <body>
    <h1>تقرير نتائج نمذجة وحركية الإمتزاز (Adsorption Modeling Report)</h1>
    <p><strong>تاريخ التقرير:</strong> ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString()}</p>
    
    <h2>1. شروط التجربة والبارامترات الأولى</h2>
    <table>
      <tr><th>المعامل</th><th>القيمة</th></tr>
      <tr><td>وزن المادة الممتزة W</td><td>${params.weightW} g</td></tr>
      <tr><td>حجم المحلول V</td><td>${params.volumeV} L</td></tr>
      <tr><td>درجة الحرارة T</td><td>${params.temperatureT} °${params.tempUnit}</td></tr>
    </table>`;

  if (isothermRes) {
    html += `<h2>2. نتائج نماذج توازن الإمتزاز (Isotherm Models)</h2>
    <table>
      <thead>
        <tr>
          <th>الموديل</th>
          <th>R²</th>
          <th>Adjusted R²</th>
          <th>RMSE</th>
          <th>MAE</th>
          <th>AIC</th>
          <th>BIC</th>
          <th>الترتيب</th>
        </tr>
      </thead>
      <tbody>`;
    isothermRes.rankedModels.forEach((m) => {
      html += `<tr>
        <td>${m.name}</td>
        <td>${m.r2.toFixed(4)}</td>
        <td>${m.adjR2.toFixed(4)}</td>
        <td>${m.rmse.toFixed(4)}</td>
        <td>${m.mae.toFixed(4)}</td>
        <td>${m.aic.toFixed(2)}</td>
        <td>${m.bic.toFixed(2)}</td>
        <td>#${m.rank}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
  }

  if (kineticsRes) {
    html += `<h2>3. نتائج نماذج حركية الإمتزاز (Adsorption Kinetics Models)</h2>
    <table>
      <thead>
        <tr>
          <th>الموديل الحركي</th>
          <th>المعاملات المُقَدَّرة (Parameters)</th>
          <th>R²</th>
          <th>Adjusted R²</th>
          <th>RMSE</th>
          <th>MAE</th>
          <th>AIC</th>
          <th>BIC</th>
          <th>الترتيب</th>
        </tr>
      </thead>
      <tbody>`;
    kineticsRes.rankedModels.forEach((m) => {
      const paramStr = Object.entries(m.params)
        .map(([k, v]) => `${k} = ${typeof v === 'number' ? v.toFixed(4) : v}`)
        .join(', ');
      html += `<tr>
        <td><strong>${m.name}</strong></td>
        <td>${paramStr}</td>
        <td>${m.r2.toFixed(4)}</td>
        <td>${m.adjR2.toFixed(4)}</td>
        <td>${m.rmse.toFixed(4)}</td>
        <td>${m.mae.toFixed(4)}</td>
        <td>${m.aic.toFixed(2)}</td>
        <td>${m.bic.toFixed(2)}</td>
        <td>#${m.rank}</td>
      </tr>`;
    });
    html += `</tbody></table>
    
    <h3>التفسير العلمي الشامل للحركية:</h3>
    <div class="interpretation">
      <p>${kineticsRes.overallInterpretation}</p>
    </div>`;
  }

  html += `</body></html>`;

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Adsorption_Modeling_Report_${Date.now()}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportToPDF(containerId: string) {
  const element = document.getElementById(containerId);
  if (!element) return;

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#0f172a',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`Adsorption_Analysis_Report_${Date.now()}.pdf`);
  } catch (err) {
    console.error('PDF Export Error:', err);
    alert('حدث خطأ أثناء تصدير ملف PDF.');
  }
}
