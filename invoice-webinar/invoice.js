function ready(fn) {
  if (document.readyState !== 'loading') fn();
  else document.addEventListener('DOMContentLoaded', fn);
}

const data = {
  count: 0,
  invoice: null,
  status: 'waiting',
  tableConnected: false,
  rowConnected: false,
  haveRows: false,
};
let app = undefined;

// ---------------- Vue Filters ----------------
Vue.filter('currency', formatNumberAsUSD);
function formatNumberAsUSD(value) {
  if (typeof value !== "number") return value || '—';
  value = Math.round(value * 100) / 100;
  const result = value.toLocaleString('en', { style: 'currency', currency: 'USD' });
  return result.includes('NaN') ? value : result;
}

Vue.filter('asDate', function(value) {
  if (typeof value === 'number') value = new Date(value * 1000);
  const date = moment.utc(value);
  return date.isValid() ? date.format('MMMM DD, YYYY') : value;
});

// ---------------- Utilities ----------------
function tweakUrl(url) {
  if (!url) return url;
  if (url.toLowerCase().startsWith('http')) return url;
  return 'https://' + url;
}

function handleError(err) {
  console.error(err);
  const target = app || data;
  target.invoice = null;
  target.status = String(err).replace(/^Error: /, '');
}

// ---------------- Demo fallback ----------------
function addDemo(row) {
  if (!row.Invoicer) row.Invoicer = { Name: 'Invoicer.Name', Street1:'', City:'', State:'', Zip:'', Email:'', Phone:'', Website:'' };
  if (!row.Client) row.Client = { Name: 'Client.Name', Street1:'', City:'', State:'', Zip:'' };
  if (!('Note' in row)) row.Note = '';
}

// ---------------- Main Invoice Update ----------------
function updateInvoice(row) {
  try {
    if (!row) throw new Error("(No data - please select a row)");

    // Merge References if present
    if (row.References) Object.assign(row, row.References);

    // ---------------- Items ----------------
    let items = [];
    if (row.Items && Array.isArray(row.Items)) {
      items = row.Items.map(i => ({
        Description: i.Description || '—',   // pull from table's Items column
        Total: i.Total != null ? i.Total : 0
      }));
    }
    row.Items = items;

    // ---------------- Totals ----------------
    if (!row.Subtotal || !row.Total) {
      const subtotal = items.reduce((sum, i) => sum + (i.Total || 0), 0);
      row.Subtotal = subtotal;
      row.Total = subtotal + (row.Taxes || 0) - (row.Deduction || 0);
    }

    // ---------------- URLs ----------------
    if (row.Invoicer && row.Invoicer.Website && !row.Invoicer.Url) {
      row.Invoicer.Url = tweakUrl(row.Invoicer.Website);
    }

    addDemo(row);  // fallback for missing fields

    data.invoice = Object.assign({}, row);
    window.invoice = row;

  } catch (err) {
    handleError(err);
  }
}

// ---------------- Ready / Event Binding ----------------
ready(function() {
  grist.ready();
  grist.onRecord(updateInvoice);

  grist.on('message', msg => {
    if (msg.tableId && !app.rowConnected) {
      grist.docApi.fetchSelectedTable().then(table => { if (table.id && table.id.length) app.haveRows = true; }).catch(e=>console.log(e));
    }
    if (msg.tableId) app.tableConnected = true;
    if (msg.tableId && !msg.dataChange) app.rowConnected = true;
  });

  Vue.config.errorHandler = (err, vm, info) => handleError(err);

  app = new Vue({
    el: '#app',
    data: data
  });

  if (document.location.search.includes('demo')) updateInvoice(exampleData);
});
