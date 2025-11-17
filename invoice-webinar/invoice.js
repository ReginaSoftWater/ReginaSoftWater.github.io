function ready(fn) {
  if (document.readyState !== 'loading') {
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

const data = {
  invoice: null,
  status: 'waiting',
  tableConnected: false,
  rowConnected: false,
  haveRows: false,
};

let app;

// ---------------- Filters ----------------
Vue.filter('currency', function(value) {
  if (typeof value !== 'number') return value || '—';
  return value.toLocaleString('en', { style: 'currency', currency: 'USD' });
});

Vue.filter('asDate', function(value) {
  if (typeof value === 'number') value = new Date(value * 1000);
  const date = moment.utc(value);
  return date.isValid() ? date.format('MMMM DD, YYYY') : value;
});

// ---------------- Utility ----------------
function tweakUrl(url) {
  if (!url) return url;
  return url.toLowerCase().startsWith('http') ? url : 'https://' + url;
}

function handleError(err) {
  console.error(err);
  const target = app || data;
  target.invoice = null;
  target.status = String(err).replace(/^Error: /, '');
}

function addDemo(row) {
  if (!('Issued' in row) && !('Due' in row)) {
    ['Number', 'Issued', 'Due'].forEach(k => { if (!(k in row)) row[k] = k; });
    ['Subtotal', 'Deduction', 'Taxes', 'Total'].forEach(k => { if (!(k in row)) row[k] = k; });
    if (!('Note' in row)) row.Note = '(Anything in a Note column goes here)';
  }
  if (!row.Invoicer) row.Invoicer = { Name: 'Invoicer.Name', Street1: '', City: '', State: '', Zip: '', Email: '', Phone: '', Website: '' };
  if (!row.Client) row.Client = { Name: 'Client.Name', Street1: '', City: '', State: '', Zip: '' };
}

// ---------------- Main Update ----------------
function updateInvoice(row) {
  try {
    data.status = '';
    if (!row) throw new Error('No row selected');

    // Merge References if present
    if (row.References) Object.assign(row, row.References);

    // Transform Items or Yearly_Rental_Dues
    let items = [];
    if (Array.isArray(row.Items) && row.Items.length) {
      items = row.Items.map(i => ({
        Description: i.Description || '—',
        Total: i.Total != null ? i.Total : 0
      }));
    } else if (row.Yearly_Rental_Dues) {
      const duesArray = Array.isArray(row.Yearly_Rental_Dues) ? row.Yearly_Rental_Dues : [row.Yearly_Rental_Dues];
      items = duesArray.map(d => ({
        Description: `${d.Service || 'Yearly Rental Dues'} - ${d.Total_After_Tax || 0}`,
        Total: d.Total_After_Tax || 0
      }));
    }
    row.Items = items;

    // Compute Subtotal & Total
    const subtotal = items.reduce((sum, i) => sum + (i.Total || 0), 0);
    row.Subtotal = subtotal;
    row.Total = subtotal + (row.Taxes || 0) - (row.Deduction || 0);

    // Ensure Invoicer URL
    if (row.Invoicer && row.Invoicer.Website && !row.Invoicer.Url) row.Invoicer.Url = tweakUrl(row.Invoicer.Website);

    // Demo fallback
    addDemo(row);

    data.invoice = Object.assign({}, row);
    window.invoice = row; // For debugging

  } catch (err) {
    handleError(err);
  }
}

// ---------------- Ready / Vue ----------------
ready(function() {
  grist.ready();
  grist.onRecord(updateInvoice);

  Vue.config.errorHandler = (err) => handleError(err);

  app = new Vue({
    el: '#app',
    data: data
  });

  if (document.location.search.includes('demo')) updateInvoice(exampleData);
  if (document.location.search.includes('labels')) updateInvoice({});
});
