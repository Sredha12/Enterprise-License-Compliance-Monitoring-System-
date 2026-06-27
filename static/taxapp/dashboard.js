document.addEventListener('DOMContentLoaded', function(){
  var input = document.getElementById('search');
  if(!input) return;
  input.addEventListener('input', function(){
    var q = input.value.trim().toLowerCase();
    var rows = document.querySelectorAll('#people-table tbody tr');
    rows.forEach(function(r){
      var name = r.cells[0].textContent.toLowerCase();
      var due = r.cells[1].textContent.toLowerCase();
      if(!q || name.indexOf(q)!==-1 || due.indexOf(q)!==-1) r.style.display=''; else r.style.display='none';
    });
  });
});
