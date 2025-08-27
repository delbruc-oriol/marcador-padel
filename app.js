
let marcador = {
  blau: 0,
  vermell: 0
};

function anotarPunt(equip) {
  if (equip === 'blau') {
    marcador.blau++;
    document.getElementById('puntBlau').innerText = marcador.blau;
  } else {
    marcador.vermell++;
    document.getElementById('puntVermell').innerText = marcador.vermell;
  }
}

function reiniciar() {
  marcador.blau = 0;
  marcador.vermell = 0;
  document.getElementById('puntBlau').innerText = marcador.blau;
  document.getElementById('puntVermell').innerText = marcador.vermell;
}

function cancelarUltimo() {
  // simplificat
  reiniciar();
}

function toggleSonido() { alert('Sonido on/off'); }
function toggleMicrofono() { alert('Micrófono on/off'); }
function ordenServicio() { alert('Orden servicio'); }
function equiposAleatorios() { alert('Equipos aleatorios'); }
function sorteoSaque() { alert('Saque aleatorio'); }
