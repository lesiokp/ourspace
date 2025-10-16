fetch('https://ourspace-production.up.railway.app/')
  .then(response => response.json())
  .then(data => {
    console.log('Backend status:', data);
  })
  .catch(error => console.error('Błąd połączenia z backendem:', error));