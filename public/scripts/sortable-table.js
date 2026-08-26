document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('table.sortable-table').forEach(function (table) {
    var tbody = table.tBodies[0];
    if (!tbody) return;
    var headers = table.querySelectorAll('th[data-sort]');
    headers.forEach(function (th) {
      th.classList.add('sortable-th');
      th.addEventListener('click', function () {
        var idx = Array.prototype.indexOf.call(th.parentNode.children, th);
        var type = th.getAttribute('data-sort');
        var wasAsc = th.getAttribute('data-dir') === 'asc';
        headers.forEach(function (h) {
          h.removeAttribute('data-dir');
          h.classList.remove('sorted-asc', 'sorted-desc');
        });
        var asc = !wasAsc;
        th.setAttribute('data-dir', asc ? 'asc' : 'desc');
        th.classList.add(asc ? 'sorted-asc' : 'sorted-desc');

        var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
        rows.sort(function (a, b) {
          var ac = a.children[idx];
          var bc = b.children[idx];
          var av = ac ? (ac.getAttribute('data-value') ?? ac.textContent.trim()) : '';
          var bv = bc ? (bc.getAttribute('data-value') ?? bc.textContent.trim()) : '';
          if (type === 'num') {
            av = parseFloat(av);
            bv = parseFloat(bv);
            if (isNaN(av)) av = -Infinity;
            if (isNaN(bv)) bv = -Infinity;
            return asc ? av - bv : bv - av;
          }
          av = String(av).toLowerCase();
          bv = String(bv).toLowerCase();
          if (av < bv) return asc ? -1 : 1;
          if (av > bv) return asc ? 1 : -1;
          return 0;
        });
        rows.forEach(function (r) { tbody.appendChild(r); });
      });
    });
  });
});
