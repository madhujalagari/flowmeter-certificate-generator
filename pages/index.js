import { useState } from 'react';
import logoBase64 from '../lib/logoBase64';

// Excel columns expected. Each ROW in the Excel is one TEST POINT reading.
// Multiple rows sharing the same SerialNo get grouped into ONE certificate
// with multiple rows in its Results table (matching the real cert format).
//
// Header-level fields (same across all test points for one flowmeter):
//   CertificateNo, OANo, CalibrationDate, DueDate, Product, SerialNo,
//   CustomerName, FlowmeterType, PowerSupply, LineSize, Accuracy,
//   CalibrationFactor, OutputSignal, CalibratedRange, Flange,
//   CalibratedBy, VerifiedBy
//
// Per-test-point fields (different on each row for the same SerialNo):
//   MasterFlowRate, CalculatedFlowRate
//
// Deviation % is calculated automatically — no need to include it in Excel.

const HEADER_FIELDS = [
  'CertificateNo', 'OANo', 'CalibrationDate', 'DueDate', 'Product', 'SerialNo',
  'CustomerName', 'FlowmeterType', 'PowerSupply', 'LineSize', 'Accuracy',
  'CalibrationFactor', 'OutputSignal', 'CalibratedRange', 'Flange',
  'CalibratedBy', 'VerifiedBy',
];

function groupRowsIntoCertificates(rows) {
  const groups = {};
  const order = [];
  const skippedRowNumbers = [];

  rows.forEach((row, i) => {
    const serial = String(row.SerialNo || '').trim();
    if (!serial) {
      skippedRowNumbers.push(i + 2); // +2: 1-indexed + header row
      return;
    }

    if (!groups[serial]) {
      groups[serial] = {
        certificateNo: row.CertificateNo,
        oaNo: row.OANo,
        calibrationDate: row.CalibrationDate,
        dueDate: row.DueDate,
        product: row.Product,
        serialNo: row.SerialNo,
        customerName: row.CustomerName,
        flowmeterType: row.FlowmeterType,
        powerSupply: row.PowerSupply,
        lineSize: row.LineSize,
        accuracy: row.Accuracy,
        calibrationFactor: row.CalibrationFactor,
        outputSignal: row.OutputSignal,
        calibratedRange: row.CalibratedRange,
        flange: row.Flange,
        calibratedBy: row.CalibratedBy,
        verifiedBy: row.VerifiedBy,
        testPoints: [],
      };
      order.push(serial);
    }

    groups[serial].testPoints.push({
      masterFlowRate: row.MasterFlowRate,
      calculatedFlowRate: row.CalculatedFlowRate,
    });
  });

  return { certificates: order.map((serial) => groups[serial]), skippedRowNumbers };
}

// Fields that must be present for a certificate to be safe to print/ship.
// Returns an array of human-readable problems, empty if all good.
function validateCertificate(cert) {
  const problems = [];

  const requiredHeaderFields = {
    certificateNo: 'Certificate No',
    oaNo: 'O.A.No',
    calibrationDate: 'Calibration Date',
    dueDate: 'Due Date',
    product: 'Product',
    customerName: 'Customer Name',
    flowmeterType: 'Type of Flowmeter',
    powerSupply: 'Power Supply',
    lineSize: 'Line Size',
    accuracy: 'Accuracy',
    calibrationFactor: 'Calibration Factor',
    outputSignal: 'Output Signal',
    calibratedRange: 'Calibrated Range',
    flange: 'Flange',
    calibratedBy: 'Calibrated By',
    verifiedBy: 'Verified By',
  };
  for (const [key, label] of Object.entries(requiredHeaderFields)) {
    if (!cert[key] || String(cert[key]).trim() === '') {
      problems.push(`Missing ${label}`);
    }
  }

  if (cert.testPoints.length === 0) {
    problems.push('No test-point readings found');
  }

  cert.testPoints.forEach((tp, i) => {
    const qm = parseFloat(tp.masterFlowRate);
    const qc = parseFloat(tp.calculatedFlowRate);
    if (tp.masterFlowRate === '' || isNaN(qm)) {
      problems.push(`Test point ${i + 1}: Master Flow Rate is missing/not a number`);
    }
    if (tp.calculatedFlowRate === '' || isNaN(qc)) {
      problems.push(`Test point ${i + 1}: Calculated Flow Rate is missing/not a number`);
    }
  });

  return problems;
}

export default function Home() {
  const [certificates, setCertificates] = useState([]);
  const [fileName, setFileName] = useState('');
  const [rowStatus, setRowStatus] = useState({});
  const [parseError, setParseError] = useState('');

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setParseError('');
    setRowStatus({});

    const XLSX = await import('xlsx');
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (json.length === 0) {
      setParseError('No rows found in the uploaded file.');
      setCertificates([]);
      return;
    }

    const foundColumns = Object.keys(json[0]);
    const missing = HEADER_FIELDS.filter((c) => !foundColumns.includes(c));

    const { certificates: grouped, skippedRowNumbers } = groupRowsIntoCertificates(json);

    const warnings = [];
    if (missing.length > 0) {
      warnings.push(`Missing expected column(s): ${missing.join(', ')}.`);
    }
    if (skippedRowNumbers.length > 0) {
      warnings.push(
        `${skippedRowNumbers.length} row(s) skipped — no SerialNo (Excel row${skippedRowNumbers.length > 1 ? 's' : ''} ${skippedRowNumbers.join(', ')}). That data was NOT included in any certificate.`
      );
    }
    if (grouped.length === 0) {
      warnings.push('No rows had a SerialNo — nothing to group into certificates.');
    }
    setParseError(warnings.join(' '));

    const withValidation = grouped.map((cert) => ({
      ...cert,
      _problems: validateCertificate(cert),
    }));

    setCertificates(withValidation);
  }

  async function handleDownload(cert, index, isRetry = false) {
    if (cert._problems && cert._problems.length > 0) {
      return; // button should be disabled anyway, this is a safety net
    }
    setRowStatus((prev) => ({ ...prev, [index]: 'loading' }));
    try {
      const { _problems, ...cleanCert } = cert;
      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanCert),
      });
      if (!res.ok) throw new Error('Generation failed');

      const driveStatus = res.headers.get('X-Drive-Status');
      const ftpStatus = res.headers.get('X-Ftp-Status');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CAL-CERT-${cert.serialNo || index}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      const uploadedTo = [];
      if (driveStatus === 'uploaded') uploadedTo.push('Drive');
      if (ftpStatus === 'uploaded') uploadedTo.push('FTP');

      setRowStatus((prev) => ({
        ...prev,
        [index]: uploadedTo.length > 0 ? `done-${uploadedTo.join('+')}` : 'done',
      }));
    } catch (err) {
      console.error(err);
      // Auto-retry once — the most common failure is a cold Chromium start
      // on the very first request after a deploy/idle period, which usually
      // succeeds on a second attempt without the person needing to notice.
      if (!isRetry) {
        return handleDownload(cert, index, true);
      }
      setRowStatus((prev) => ({ ...prev, [index]: 'error' }));
    }
  }

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  async function handleGenerateAll() {
    const validCerts = certificates
      .map((cert, index) => ({ cert, index }))
      .filter(({ cert }) => !cert._problems || cert._problems.length === 0);

    if (validCerts.length === 0) return;

    setBulkRunning(true);
    setBulkProgress({ done: 0, total: validCerts.length });

    // Sequential on purpose: browsers can block/merge many simultaneous
    // downloads, and this also avoids hammering the PDF-generation
    // function (Puppeteer cold starts) all at once.
    for (let i = 0; i < validCerts.length; i++) {
      const { cert, index } = validCerts[i];
      await handleDownload(cert, index);
      setBulkProgress({ done: i + 1, total: validCerts.length });
    }

    setBulkRunning(false);
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.brandHeader}>
        <img src={logoBase64} alt="Mirrant" style={styles.brandLogo} />
        <div style={{ flex: 1 }}>
          <h1 style={styles.h1}>Flowmeter Calibration Certificate Generator</h1>
          <p style={styles.subtitle}>
            Upload the daily calibration Excel sheet. Rows sharing the same Serial No are grouped
            into one certificate, each with its own set of test-point readings.
          </p>
        </div>
        <button onClick={handleLogout} style={styles.logoutBtn}>Log out</button>
      </div>

      <div style={styles.uploadBox}>
        <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
        {fileName && <p style={{ marginTop: 8, fontSize: 13, color: '#666' }}>Loaded: {fileName}</p>}
        {parseError && <p style={{ marginTop: 8, fontSize: 13, color: '#b45309' }}>{parseError}</p>}
      </div>

      {certificates.length > 0 && (
        <>
          <div style={styles.bulkBar}>
            <button
              onClick={handleGenerateAll}
              disabled={bulkRunning}
              style={styles.bulkBtn}
            >
              {bulkRunning
                ? `Generating ${bulkProgress.done}/${bulkProgress.total}...`
                : `Generate All (${certificates.filter((c) => !c._problems?.length).length} valid)`}
            </button>
            {certificates.some((c) => c._problems?.length > 0) && (
              <span style={styles.bulkWarning}>
                {certificates.filter((c) => c._problems?.length > 0).length} certificate(s) have issues and will be skipped — see ⚠ rows below
              </span>
            )}
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Serial No</th>
                  <th style={styles.th}>Product</th>
                  <th style={styles.th}>Line Size</th>
                  <th style={styles.th}>Customer</th>
                  <th style={styles.th}>Test Points</th>
                  <th style={styles.th}>Certificate</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((cert, i) => {
                  const hasProblems = cert._problems && cert._problems.length > 0;
                  return (
                    <tr key={i} style={hasProblems ? styles.problemRow : undefined}>
                      <td style={styles.td} title={hasProblems ? cert._problems.join('; ') : 'Looks good'}>
                        {hasProblems ? '⚠️' : '✅'}
                      </td>
                      <td style={styles.td}>{cert.serialNo}</td>
                      <td style={styles.td}>{cert.product}</td>
                      <td style={styles.td}>{cert.lineSize}</td>
                      <td style={styles.td}>{cert.customerName}</td>
                      <td style={styles.td}>{cert.testPoints.length}</td>
                      <td style={styles.td}>
                        {hasProblems ? (
                          <span style={styles.problemText}>{cert._problems[0]}{cert._problems.length > 1 ? ` (+${cert._problems.length - 1} more)` : ''}</span>
                        ) : (
                          <button
                            onClick={() => handleDownload(cert, i)}
                            disabled={rowStatus[i] === 'loading'}
                            style={styles.downloadBtn}
                          >
                            {rowStatus[i] === 'loading'
                              ? 'Generating...'
                              : rowStatus[i]?.startsWith('done-')
                              ? `Downloaded ✓ (saved to ${rowStatus[i].replace('done-', '')})`
                              : rowStatus[i] === 'done'
                              ? 'Downloaded ✓'
                              : rowStatus[i] === 'error'
                              ? 'Retry'
                              : 'Download PDF'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    maxWidth: 1100,
    margin: '40px auto',
    padding: '0 20px',
    fontFamily: 'Arial, sans-serif',
  },
  brandHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    marginBottom: 24,
    paddingBottom: 20,
    borderBottom: '3px solid #D6322C',
  },
  brandLogo: {
    height: 56,
    flexShrink: 0,
  },
  logoutBtn: {
    padding: '8px 14px',
    background: 'transparent',
    color: '#D6322C',
    border: '1px solid #D6322C',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    flexShrink: 0,
  },
  h1: {
    margin: 0,
    fontSize: 22,
    color: '#1a1a1a',
  },
  subtitle: {
    margin: '6px 0 0 0',
    color: '#666',
    fontSize: 13,
  },
  uploadBox: {
    border: '2px dashed #D6322C55',
    borderRadius: 8,
    padding: 24,
    marginBottom: 24,
    background: '#fafafa',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    background: '#D6322C',
    color: 'white',
  },
  td: {
    padding: '8px 12px',
    borderBottom: '1px solid #eee',
  },
  downloadBtn: {
    padding: '6px 12px',
    background: '#D6322C',
    color: 'white',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
  },
  bulkBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  bulkBtn: {
    padding: '10px 18px',
    background: '#D6322C',
    color: 'white',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 'bold',
  },
  bulkWarning: {
    fontSize: 12,
    color: '#b45309',
  },
  problemRow: {
    background: '#fff7ed',
  },
  problemText: {
    fontSize: 11,
    color: '#b00020',
  },
};
