(function () {
  'use strict';

  var DEFAULT_URL = './data/eng-tables.json';
  var cache = null;
  var pendingPromise = null;

  function load(url, forceReload) {
    var targetUrl = typeof url === 'string' && url ? url : DEFAULT_URL;
    var force = typeof url === 'boolean' ? url : Boolean(forceReload);

    if (!force && cache) {
      return Promise.resolve(cache);
    }
    if (!force && pendingPromise) {
      return pendingPromise;
    }

    pendingPromise = fetch(targetUrl)
      .then(function (res) {
        if (!res.ok) {
          throw new Error('Failed to load engineering tables: HTTP ' + res.status);
        }
        return res.json();
      })
      .then(function (data) {
        cache = data;
        pendingPromise = null;
        return cache;
      })
      .catch(function (err) {
        pendingPromise = null;
        throw err;
      });

    return pendingPromise;
  }

  function setData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('EngTables.setData requires a valid object.');
    }
    cache = data;
    pendingPromise = null;
    return cache;
  }

  function resolveEntry(name) {
    if (!cache || !name || typeof name !== 'string') {
      return null;
    }
    if (name.indexOf('.') !== -1) {
      var parts = name.split('.');
      var section = parts[0];
      var key = parts.slice(1).join('.');
      if (cache[section] && cache[section][key]) {
        return { section: section, key: key, data: cache[section][key] };
      }
    }
    if (cache.tables && cache.tables[name]) {
      return { section: 'tables', key: name, data: cache.tables[name] };
    }
    if (cache.factors && cache.factors[name]) {
      return { section: 'factors', key: name, data: cache.factors[name] };
    }
    return null;
  }

  function get(name) {
    var entry = resolveEntry(name);
    return entry ? entry.data : null;
  }

  function list(section) {
    if (!cache) {
      return section ? [] : { tables: [], factors: [] };
    }
    var tables = cache.tables ? Object.keys(cache.tables) : [];
    var factors = cache.factors ? Object.keys(cache.factors) : [];
    if (section === 'tables') {
      return tables;
    }
    if (section === 'factors') {
      return factors;
    }
    return { tables: tables, factors: factors };
  }

  function meta(name) {
    var entry = resolveEntry(name);
    if (!entry) {
      return null;
    }
    var tbl = entry.data;
    return {
      key: entry.key,
      section: entry.section,
      title: tbl.title || '',
      source: tbl.source || '',
      status: tbl.status || '',
      unit: tbl.unit || '',
      conditions: tbl.conditions || {}
    };
  }

  function lookup(name, matchKey, matchValue, valueKey) {
    var tbl = get(name);
    if (!tbl || !Array.isArray(tbl.rows)) {
      return null;
    }
    var row = null;
    if (matchKey && typeof matchKey === 'object') {
      var keys = Object.keys(matchKey);
      row = tbl.rows.find(function (r) {
        return keys.every(function (k) {
          return r[k] === matchKey[k];
        });
      }) || null;
      return row;
    }
    row = tbl.rows.find(function (r) {
      return r[matchKey] === matchValue;
    }) || null;
    if (!row) {
      return null;
    }
    if (typeof valueKey === 'string' && valueKey) {
      return Object.prototype.hasOwnProperty.call(row, valueKey) ? row[valueKey] : null;
    }
    return row;
  }

  window.EngTables = {
    load: load,
    setData: setData,
    get: get,
    list: list,
    meta: meta,
    lookup: lookup
  };
})();
