function ready(fn) {
  if (document.readyState !== 'loading') fn();
  else document.addEventListener('DOMContentLoaded', fn);
}

const data = {
  invoice: null,
  status: 'waiting',
  tableConnected: false,
  rowConnected: false,
  haveRows: false,
};
let app = undefined;

Vue.filter('currency', val => {
  if (typeof val !== 'number') return val || '—';
  return val.toLocaleString('en', { style: 'currency', currency: 'USD' });
});

Vue.filter('asDate', val => {
  if (!val) return '—';
  const date = moment(val);
  return date.isValid() ? date.format('MMMM DD, YYYY') : val;
});

function handleError(err) {
  console.error(err);
  const target = app || data;
  target.invoice = null;
  target.status = String(err).replace(/^Error: /, '');
}

function updateInvoice(row) {
  try {
    if (!row) throw new Error("No row selected");

    // Pull from the Items column in the table
    let items = [];
    if (row.Items && Array.isArray(row.Items)) {
      items = row.Items.map(i => ({
        Description: i.Description || '—',
        Total: i.Total != null ? i.Total : 0
      }));
    }

    // Compute subtotal and total
    const subtotal = items.reduce((sum, i) => sum + (i.Total || 0), 0);
    row.Subtotal = subtotal;
    row.Total = subtotal + (row.Taxes || 0) - (row.Deduction || 0);

    row.Items = items;
    data.invoice = Object.assign({}, row);
    window.invoice = row;

  } catch (err) {
    handleError(err);
  }
}

ready(() => {
  grist.ready();
  grist.onRecord(updateInvoice);

  app = new Vue({ el: '#app', data });

  if (document.location.search.includes('demo') && typeof exampleData !== 'undefined') {
    updateInvoice(exampleData);
  }
});
