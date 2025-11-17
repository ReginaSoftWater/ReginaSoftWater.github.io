function ready(fn) {
  if (document.readyState !== 'loading') {
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
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

// ------------------------
// Vue Filters
// ------------------------
Vue.filter('currency', formatNumberAsUSD);
function formatNumberAsUSD(value) {
  if (typeof value !== "number") return value || '—';
  value = Math.round(value * 100) / 100;
  value = (value === -0 ? 0 : value);
  const result = value.toLocaleString('en', { style: 'currency', currency: 'USD' });
  return result.includes('NaN') ? value : result;
}

Vue.filter('asDate', function(value) {
  if (typeof value === 'number') value = new Date(value * 1000);
  const date = moment.utc(value);
  return date.isValid() ? date.format('MMMM DD, YYYY') : value;
});

// ------------------------
// Utility Functions
// ------------------------
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

// ------------------------
// Demo Fallback / Guidance
// ------------------------
function addDemo(row) {
  if (!('Issued' in row) && !('Due' in row)) {
    ['Number', 'Issued', 'Due'].forEach(k => { if (!(k in row)) row[k] = k; });
    ['Subtotal', 'Deduction', 'Taxes', 'Total'].forEach(k => { if (!(k in row)) row[k] = k; });
    if (!('Note' in row)) row.Note = '(Anything in a Note column goes here)';
  }

  if (!row.Invoicer) {
    row.Invoicer = {
      Name: 'Invoicer.Name',
      Street1: 'Invoicer.Street1',
      Street2: 'Invoicer.Street2',
      City: 'Invoicer.City',
      State: '.State',
      Zip: '.Zip',
      Email: 'Invoicer.Email',
      Phone: 'Invoicer.Phone',
      Website: 'Invoicer.Website',
    };
  }

  if (!row.Client) {
    row.Client = {
      Name: 'Client.Name',
      Street1: 'Client.Street1',
      Street2: 'Client.Street2',
      City: 'Client.City',
      State: '.State',
      Zip: '.Zip',
    };
  }
}

// ------------------------
// Main Invoice Update
// ------------------------
function updateInvoice(row) {
  try {
    data.status = '';
    if (!row) throw new Error("(No data - not on row - please add or select a row)");

    // Merge References if present
    if (row.References) {
      try {
        Object.assign(row, row.References);
      } catch (err) {
        throw new Error('Could not understand References column. ' + err);
      }
    }

    // -------------------------------
    // Use Items column directly for table
    // -------------------------------
    if (row.Items && Array.isArray(row.Items)) {
      // Map to only Description + Total
      row.Items = row.Items.map(item => ({
        Description: item.Description || '—',
        Total: item.Total || item.Cost || '—'   // fallback if you have Total or Cost
      }));
    } else {
      row.Items = [];
    }

    // Assign to Vue data
    data.invoice = row;

  } catch (err) {
    console.error(err);
    data.status = err.message || 'Error updating invoice';
    data.invoice = null;
  }
}

    // -------------------------------
    // Transform Yearly_Rental_Dues into simple Items
    // -------------------------------
    let items = [];
    if (row.Yearly_Rental_Dues) {
      const duesArray = Array.isArray(row.Yearly_Rental_Dues) ? row.Yearly_Rental_Dues : [row.Yearly_Rental_Dues];
      items = duesArray.map(d => ({
        Description: `${d.Service || 'Yearly Rental Dues'} - ${d.Total_After_Tax || 0}`,
        Total: d.Total_After_Tax || 0,
      }));
    }

    row.Items = items;  // Vue template expects invoice.Items

    // Compute Subtotal & Total safely if missing
    if (!row.Subtotal || !row.Total) {
      const subtotal = items.reduce((sum, i) => sum + (i.Total || 0), 0);
      row.Subtotal = subtotal;
      row.Total = subtotal + (row.Taxes || 0) - (row.Deduction || 0);
    }

    // Ensure Invoicer URL is valid
    if (row.Invoicer && row.Invoicer.Website && !row.Invoicer.Url) {
      row.Invoicer.Url = tweakUrl(row.Invoicer.Website);
    }

    // Add demo fallback for missing fields
    addDemo(row);

    // Assign the updated invoice to Vue
    data.invoice = Object.assign({}, row);

    // Also make available for debugging
    window.invoice = row;

  } catch (err) {
    handleError(err);
  }
}

// ------------------------
// Ready / Event Binding
// ------------------------
ready(function() {
  grist.ready();
  grist.onRecord(updateInvoice);

  grist.on('message', msg => {
    if (msg.tableId && !app.rowConnected) {
      grist.docApi.fetchSelectedTable().then(table => { if (table.id && table.id.length) app.haveRows = true; })
        .catch(e => console.log(e));
    }
    if (msg.tableId) app.tableConnected = true;
    if (msg.tableId && !msg.dataChange) app.rowConnected = true;
  });

  Vue.config.errorHandler = (err, vm, info) => { handleError(err); };

  app = new Vue({
    el: '#app',
    data: data,
  });

  if (document.location.search.includes('demo')) updateInvoice(exampleData);
  if (document.location.search.includes('labels')) updateInvoice({});
});
