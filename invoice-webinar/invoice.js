function ready(fn) {
  if (document.readyState !== 'loading'){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

function addDemo(row) {
  if (!('Issued' in row) && !('Due' in row)) {
    for (const key of ['Number', 'Issued', 'Due']) {
      if (!(key in row)) { row[key] = key; }
    }
    for (const key of ['Subtotal', 'Deduction', 'Taxes', 'Total']) {
      if (!(key in row)) { row[key] = key; }
    }
    if (!('Note' in row)) { row.Note = '(Anything in a Note column goes here)'; }
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
      Website: 'Invoicer.Website'
    }
  }
  if (!row.Client) {
    row.Client = {
      Name: 'Client.Name',
      Street1: 'Client.Street1',
      Street2: 'Client.Street2',
      City: 'Client.City',
      State: '.State',
      Zip: '.Zip'
    }
  }

  // Make sure Items exists and has Description/Total
  if (!row.Items) {
    row.Items = [
      {
        Description: 'Items[0].Description',
        Quantity: 1,
        Total: 0,
        Price: 0,
      }
    ];
  } else if (Array.isArray(row.Items)) {
    // Map Items to guarantee Description and Total exist
    row.Items = row.Items.map(item => ({
      Description: item.Description || '—',
      Quantity: item.Quantity || 1,
      Price: item.Price || 0,
      Total: item.Total != null ? item.Total : (item.Price ? item.Price * (item.Quantity || 1) : 0)
    }));
  }

  return row;
}

const data = {
  count: 0,
  invoice: '',
  status: 'waiting',
  tableConnected: false,
  rowConnected: false,
  haveRows: false,
};
let app = undefined;

Vue.filter('currency', formatNumberAsUSD)
function formatNumberAsUSD(value) {
  if (typeof value !== "number") return value || '—';
  value = Math.round(value * 100) / 100;
  value = (value === -0 ? 0 : value);
  const result = value.toLocaleString('en', { style: 'currency', currency: 'USD' });
  return result.includes('NaN') ? value : result;
}

Vue.filter('fallback', function(value, str) {
  if (!value) throw new Error("Please provide column " + str);
  return value;
});

Vue.filter('asDate', function(value) {
  if (typeof(value) === 'number') value = new Date(value * 1000);
  const date = moment.utc(value)
  return date.isValid() ? date.format('MMMM DD, YYYY') : value;
});

function tweakUrl(url) {
  if (!url) return url;
  if (url.toLowerCase().startsWith('http')) return url;
  return 'https://' + url;
};

function handleError(err) {
  console.error(err);
  const target = app || data;
  target.invoice = '';
  target.status = String(err).replace(/^Error: /, '');
}

function prepareList(lst, order) {
  if (order) {
    let orderedLst = [];
    const remaining = new Set(lst);
    for (const key of order) if (remaining.has(key)) { remaining.delete(key); orderedLst.push(key); }
    lst = [...orderedLst].concat([...remaining].sort());
  } else lst = [...lst].sort();
  return lst;
}

function updateInvoice(row) {
  try {
    data.status = '';
    if (!row) throw new Error("(No data - please add or select a row)");

    if (row.References) Object.assign(row, row.References);

    const want = new Set(Object.keys(addDemo({})));
    const accepted = new Set(['References']);
    const importance = ['Number', 'Client', 'Items', 'Total', 'Invoicer', 'Due', 'Issued', 'Subtotal', 'Deduction', 'Taxes', 'Note', 'Paid'];

    addDemo(row);

    // Compute Subtotal/Total if missing
    if (!row.Subtotal && !row.Total && row.Items && Array.isArray(row.Items)) {
      try {
        row.Subtotal = row.Items.reduce((a,b)=>a+(b.Total || b.Price*b.Quantity ||0),0);
        row.Total = row.Subtotal + (row.Taxes||0) - (row.Deduction||0);
      } catch(e){console.error(e);}
    }

    if (row.Invoicer && row.Invoicer.Website && !row.Invoicer.Url) row.Invoicer.Url = tweakUrl(row.Invoicer.Website);

    // Clean old keys
    for (const key of want) Vue.delete(data.invoice, key);
    for (const key of ['Help','SuggestReferencesColumn','References']) Vue.delete(data.invoice, key);

    data.invoice = Object.assign({}, data.invoice, row);
    window.invoice = row;

  } catch (err) {
    handleError(err);
  }
}

ready(function() {
  grist.ready();
  grist.onRecord(updateInvoice);

  grist.on('message', msg => {
    if (msg.tableId && !app.rowConnected) {
      grist.docApi.fetchSelectedTable().then(table => {
        if (table.id && table.id.length >= 1) app.haveRows = true;
      }).catch(e=>console.log(e));
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
  if (document.location.search.includes('labels')) updateInvoice({});
});
