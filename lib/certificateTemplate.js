const logoBase64 = require('./logoBase64');

// `cert` shape:
// {
//   certificateNo, oaNo, calibrationDate, dueDate, product, serialNo,
//   customerName, flowmeterType, powerSupply, lineSize, accuracy,
//   calibrationFactor, outputSignal, calibratedRange, flange,
//   calibratedBy, verifiedBy,
//   testPoints: [ { masterFlowRate, calculatedFlowRate }, ... ]
// }
// Deviation % for each test point is calculated automatically as
// (Qc - Qm) / Qc * 100, matching the formula printed on the certificate.

function certificateTemplate(cert) {
  const testPoints = cert.testPoints || [];

  const resultRows = testPoints
    .map((tp, i) => {
      const qm = parseFloat(tp.masterFlowRate);
      const qc = parseFloat(tp.calculatedFlowRate);
      const deviation = qc !== 0 ? ((qc - qm) / qc) * 100 : 0;
      return `
        <tr>
          <td class="center">${i + 1}</td>
          <td class="center">${escapeHtml(formatNumber(qm))}</td>
          <td class="center">${escapeHtml(formatNumber(qc))}</td>
          <td class="center">${escapeHtml(deviation.toFixed(3))}</td>
        </tr>`;
    })
    .join('');

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: A4; margin: 0; }
      * { box-sizing: border-box; }
      body {
        font-family: Arial, Helvetica, sans-serif;
        margin: 0;
        padding: 24px;
        color: #000;
        font-size: 12px;
      }
      .outer {
        border: 1px solid #000;
      }
      .header {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid #000;
      }
      .header img {
        height: 60px;
        margin-right: 16px;
      }
      .header .company {
        text-align: center;
        flex: 1;
        font-size: 13px;
        line-height: 1.5;
      }
      .header .company .name {
        font-weight: bold;
        font-size: 15px;
      }
      .title {
        text-align: center;
        font-weight: bold;
        font-size: 15px;
        padding: 8px;
        border-bottom: 1px solid #000;
      }
      table.form {
        width: 100%;
        border-collapse: collapse;
      }
      table.form td {
        border: 1px solid #000;
        padding: 6px 10px;
        vertical-align: top;
      }
      table.form td.label {
        font-weight: bold;
        width: 22%;
      }
      .section-title {
        font-weight: bold;
        text-align: center;
        padding: 6px;
        border-top: 1px solid #000;
        border-bottom: 1px solid #000;
        background: #f2f2f2;
      }
      .formula-box {
        display: flex;
        padding: 10px 16px;
        border-bottom: 1px solid #000;
        font-size: 12px;
      }
      .formula-box .col {
        flex: 1;
      }
      .nomenclature-box {
        padding: 10px 16px;
        border-bottom: 1px solid #000;
        font-size: 12px;
        display: flex;
      }
      .nomenclature-box .col {
        flex: 1;
      }
      .method-box {
        padding: 10px 16px;
        border-bottom: 1px solid #000;
        font-size: 12px;
      }
      .method-box .label {
        font-weight: bold;
      }
      table.results {
        width: 100%;
        border-collapse: collapse;
      }
      table.results th, table.results td {
        border: 1px solid #000;
        padding: 8px;
        font-size: 12px;
      }
      table.results th {
        background: #f2f2f2;
        text-align: center;
      }
      .center { text-align: center; }
      .sign-box {
        display: flex;
        justify-content: space-between;
        padding: 20px 16px 40px 16px;
        border-bottom: 1px solid #000;
        font-size: 12px;
      }
      .sign-box .col {
        width: 45%;
      }
      .sign-box .sig-line {
        margin-top: 30px;
        border-top: 1px solid #000;
        padding-top: 4px;
      }
      .guarantee {
        padding: 10px 16px;
        font-size: 10.5px;
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <div class="outer">
      <div class="header">
        <img src="${logoBase64}" alt="Mirrant logo" />
        <div class="company">
          <div class="name">Mirrant Automation Pvt.Ltd.</div>
          <div>Plot No:6A/5,IDA Phase-I, Patancheru,Sangareddy Dist.,</div>
          <div>Hyderabad-502319,Telangana,INDIA</div>
        </div>
      </div>

      <div class="title">Calibration Certificate</div>

      <table class="form">
        <tr>
          <td class="label">Certificate No</td>
          <td>${escapeHtml(cert.certificateNo)}</td>
          <td class="label">O.A.No</td>
          <td>${escapeHtml(cert.oaNo)}</td>
        </tr>
        <tr>
          <td class="label">Calibration Date</td>
          <td>${escapeHtml(cert.calibrationDate)}</td>
          <td class="label">Due Date</td>
          <td>${escapeHtml(cert.dueDate)}</td>
        </tr>
        <tr>
          <td class="label">Product</td>
          <td>${escapeHtml(cert.product)}</td>
          <td class="label">Sr No</td>
          <td>${escapeHtml(cert.serialNo)}</td>
        </tr>
        <tr>
          <td class="label">Customer Name</td>
          <td colspan="3">${escapeHtml(cert.customerName)}</td>
        </tr>
      </table>

      <div class="section-title">Details of Flow meter</div>
      <table class="form">
        <tr>
          <td class="label">Type of Flowmeter</td>
          <td>${escapeHtml(cert.flowmeterType)}</td>
          <td class="label">Power Supply</td>
          <td>${escapeHtml(cert.powerSupply)}</td>
        </tr>
        <tr>
          <td class="label">Line Size</td>
          <td>${escapeHtml(cert.lineSize)}</td>
          <td class="label">Accuracy</td>
          <td>${escapeHtml(cert.accuracy)}</td>
        </tr>
        <tr>
          <td class="label">Calibration Factor</td>
          <td>${escapeHtml(cert.calibrationFactor)}</td>
          <td class="label">Output Signal</td>
          <td>${escapeHtml(cert.outputSignal)}</td>
        </tr>
        <tr>
          <td class="label">Calibrated Range</td>
          <td>${escapeHtml(cert.calibratedRange)}</td>
          <td class="label">Flange</td>
          <td>${escapeHtml(cert.flange)}</td>
        </tr>
      </table>

      <div class="section-title">List of Formulae</div>
      <div class="formula-box">
        <div class="col">
          1) Qc&nbsp;&nbsp;=&nbsp;&nbsp;(C-4) x Calibration range<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(m3/h)&nbsp;&nbsp;&nbsp;&nbsp;16
        </div>
        <div class="col">
          2) % of Deviation&nbsp;&nbsp;=&nbsp;&nbsp;(Qc-Qm) x 100<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;in Qc&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Qm
        </div>
      </div>

      <div class="section-title">Nomenclature</div>
      <div class="nomenclature-box">
        <div class="col">
          Qm = Master Flow Rate<br/>
          C&nbsp;&nbsp;= Current output of UUC
        </div>
        <div class="col">
          Qc&nbsp;&nbsp;= Flow Rate Calculated from<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;Current c
        </div>
      </div>

      <div class="method-box">
        <div><span class="label">Calibration Method</span> : Comparison Method</div>
        <div><span class="label">Traceability</span> : All the instrument used or traceable to National standards through reference</div>
        <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Standards and their calibrations are valid.</div>
      </div>

      <div class="section-title">Calibration Results</div>
      <table class="results">
        <thead>
          <tr>
            <th rowspan="2">Sr.No</th>
            <th>Master Flow Rate<br/>(Qm)</th>
            <th>Calculated Flow Rate<br/>(Qc)</th>
            <th>Deviation in<br/>(Qc)</th>
          </tr>
          <tr>
            <th>m3/h</th>
            <th>m3/h</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          ${resultRows}
        </tbody>
      </table>

      <div class="sign-box">
        <div class="col">
          <div>Calibrated By :- ${escapeHtml(cert.calibratedBy)}</div>
          <div class="sig-line">Signature :</div>
        </div>
        <div class="col">
          <div>Verified By :- ${escapeHtml(cert.verifiedBy)}</div>
          <div class="sig-line">Signature :</div>
        </div>
      </div>

      <div class="guarantee">
        It is hereby certified that the equipment mentioned above has been tested and found to meet its specifications.
        The Performance of the above equipment is guaranteed for period of 12 months from the date of installation
        or 18 months from the date of dispatch, whichever is earlier, against any manufacturing defects only.
      </div>
    </div>
  </body>
  </html>
  `;
}

function formatNumber(n) {
  if (isNaN(n)) return '-';
  return n.toFixed(3);
}

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = { certificateTemplate };
