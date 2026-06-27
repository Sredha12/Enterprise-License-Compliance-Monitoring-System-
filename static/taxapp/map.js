document.addEventListener('DOMContentLoaded', function () {
  var mapEl = document.getElementById('map-canvas');
  if (!mapEl) return;

  var map = L.map(mapEl).setView([11.55, 75.83], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  var legendControl = L.control({ position: 'bottomright' });
  legendControl.onAdd = function () {
    var el = L.DomUtil.create('div', 'map-legend');
    el.innerHTML = '<div><span class="legend-line" style="background:#0033aa"></span> Boundary polygon</div>' +
      '<div><span class="legend-swatch" style="background:#d40000"></span> Licensed building</div>';
    return el;
  };
  legendControl.addTo(map);

  var geoUrl = typeof window.GEOJSON_URL !== 'undefined' ? window.GEOJSON_URL : null;
  var licensesUrl = typeof window.LICENSES_URL !== 'undefined' ? window.LICENSES_URL : null;
  var licensedListEl = document.getElementById('licensed-buildings');
  var statusFilter = document.getElementById('license-status-filter');
  var typeFilter = document.getElementById('license-type-filter');
  var allLicenseData = [];
  var activeLicenseLayer = null;
  var boundaryLayer = null;

  function getFeatureName(feature) {
    if (!feature) return '';
    var props = feature.properties || {};
    return props.name || props.NAME || props.Name || '';
  }

  function matchesChakkittapara(feature) {
    if (!feature) return false;
    var id = feature.id !== undefined && feature.id !== null ? String(feature.id) : '';
    if (id.indexOf('11318940') !== -1) return true;
    var name = getFeatureName(feature);
    return typeof name === 'string' && name.toLowerCase().indexOf('chakkittapara') !== -1;
  }

  function renderGeojsonFeatures(data) {
    if (!data) return null;
    if (data.type && data.type.toLowerCase() === 'feature') {
      data = { type: 'FeatureCollection', features: [data] };
    }
    if (!data.features || !Array.isArray(data.features)) return null;
    var features = data.features.filter(matchesChakkittapara);
    if (!features.length) return null;
    return L.geoJSON({ type: 'FeatureCollection', features: features }, {
      style: function () {
        return { color: '#0033aa', weight: 4, fillOpacity: 0.15 };
      },
      onEachFeature: function (feature, layer) {
        var name = getFeatureName(feature);
        if (name) {
          layer.bindPopup('<strong>' + name + '</strong>');
        }
      }
    });
  }

  function renderLicenseMarkers(licenses) {
    if (!Array.isArray(licenses) || !licenses.length) return null;
    var cluster = L.markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false
    });
    licenses.forEach(function (item) {
      if (!item || item.latitude == null || item.longitude == null) return;
      var marker = L.circleMarker([item.latitude, item.longitude], {
        radius: 8,
        fillColor: '#d40000',
        color: '#ffffff',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.92
      });
      var popupParts = ['<strong>' + (item.name || 'Licensed building') + '</strong>'];
      if (item.licenseId) popupParts.push('License: ' + item.licenseId);
      if (item.type) popupParts.push('Type: ' + item.type);
      if (item.status) popupParts.push('Status: ' + item.status);
      if (item.address) popupParts.push('Address: ' + item.address);
      marker.bindPopup(popupParts.join('<br/>'));
      cluster.addLayer(marker);
    });
    return cluster.getLayers().length ? cluster : null;
  }

  function renderLicenseList(licenses) {
    if (!licensedListEl || !Array.isArray(licenses)) return;
    licensedListEl.innerHTML = '';
    licenses.slice(0, 10).forEach(function (item) {
      var listItem = document.createElement('li');
      listItem.innerHTML = '<div class="building-name">' + (item.name || 'Licensed building') + '</div>' +
        '<div class="building-meta">' +
        '<span class="status">' + (item.status || 'Unknown') + '</span>' +
        (item.licenseId ? ' ' + item.licenseId : '') +
        (item.type ? ' · ' + item.type : '') +
        '<br/>' + (item.address || '') +
        '</div>';
      licensedListEl.appendChild(listItem);
    });
  }

  function updateFilterOptions(licenses) {
    if (!Array.isArray(licenses)) return;
    var statuses = new Set();
    var types = new Set();
    licenses.forEach(function (item) {
      if (item && item.status) statuses.add(item.status);
      if (item && item.type) types.add(item.type);
    });
    [statusFilter, typeFilter].forEach(function (select) {
      if (!select) return;
      var defaultOption = select === statusFilter ? '<option value="">All statuses</option>' : '<option value="">All types</option>';
      select.innerHTML = defaultOption;
    });
    Array.from(statuses).sort().forEach(function (status) {
      var opt = document.createElement('option');
      opt.value = status;
      opt.textContent = status;
      statusFilter.appendChild(opt);
    });
    Array.from(types).sort().forEach(function (type) {
      var opt = document.createElement('option');
      opt.value = type;
      opt.textContent = type;
      typeFilter.appendChild(opt);
    });
  }

  function filterLicenses() {
    if (!Array.isArray(allLicenseData)) return allLicenseData;
    var selectedStatus = statusFilter ? statusFilter.value : '';
    var selectedType = typeFilter ? typeFilter.value : '';
    return allLicenseData.filter(function (item) {
      var statusMatch = !selectedStatus || item.status === selectedStatus;
      var typeMatch = !selectedType || item.type === selectedType;
      return statusMatch && typeMatch;
    });
  }

  function applyLicenseFilters(licenses) {
    if (!Array.isArray(licenses)) licenses = [];
    var filtered = filterLicenses();
    if (activeLicenseLayer) {
      map.removeLayer(activeLicenseLayer);
      activeLicenseLayer = null;
    }
    activeLicenseLayer = renderLicenseMarkers(filtered);
    if (activeLicenseLayer) {
      activeLicenseLayer.addTo(map);
    }
    renderLicenseList(filtered);
    if (boundaryLayer && activeLicenseLayer) {
      fitToLayer(L.featureGroup([boundaryLayer, activeLicenseLayer]));
    } else if (boundaryLayer) {
      fitToLayer(boundaryLayer);
    } else if (activeLicenseLayer) {
      fitToLayer(activeLicenseLayer);
    }
  }

  if (statusFilter && typeFilter) {
    [statusFilter, typeFilter].forEach(function (select) {
      select.addEventListener('change', function () {
        applyLicenseFilters(allLicenseData);
      });
    });
  }

  function fitToLayer(layer) {
    if (layer && layer.getBounds && typeof layer.getBounds === 'function') {
      map.fitBounds(layer.getBounds().pad(0.12));
    } else {
      map.setView([11.55, 75.83], 12);
    }
  }

  if (!geoUrl) {
    console.warn('No GeoJSON URL set for map.');
    return;
  }

  var geoFetch = fetch(geoUrl).then(function (res) {
    if (!res.ok) throw new Error('Failed fetching GeoJSON');
    return res.json();
  });

  var licenseFetch = licensesUrl ? fetch(licensesUrl).then(function (res) {
    if (!res.ok) throw new Error('Failed fetching licenses');
    return res.json();
  }).catch(function () {
    return [];
  }) : Promise.resolve([]);

  Promise.all([geoFetch, licenseFetch])
    .then(function (results) {
      var geojson = results[0];
      var licenses = results[1];
      boundaryLayer = renderGeojsonFeatures(geojson);
      if (boundaryLayer) {
        boundaryLayer.addTo(map);
      }
      allLicenseData = Array.isArray(licenses) ? licenses : [];
      updateFilterOptions(allLicenseData);
      applyLicenseFilters(allLicenseData);
    })
    .catch(function (err) {
      console.error('Error loading map data:', err);
    });
});
