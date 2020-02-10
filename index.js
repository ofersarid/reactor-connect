require('firebase/firestore');
require('firebase/auth');
require('firebase/storage');
require('firebase/database');
const Promise = require('promise');
const firebase = require('firebase/app');
const camelCase = require('lodash/camelCase');
const extend = require('lodash/extend');
const immutable = require('immutable');

const structuredData = {
  collections: {},
  pages: {},
};

const STORE_DATA = 'REACTOR/STORE_DATA';

if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: 'AIzaSyCVoJ1fNik-brXSirPwXfzEzpK4HDJyIdE',
    authDomain: 'reactor-dam.firebaseapp.com',
    databaseURL: 'https://reactor-dam.firebaseio.com',
    projectId: 'reactor-dam',
    storageBucket: 'reactor-dam.appspot.com',
    messagingSenderId: '198256799515'
  });
}

const getData = async (userId) => {
  const db = firebase.firestore();
  const user = await db.collection('users').doc(userId).get();
  const userData = await user.data();
  if (userData.collections) {
    for (const id of userData.collections) {
      const item = await db.collection('collections').doc(id).get();
      const data = await item.data();
      const order = data.order.split(' | ');
      structuredData.collections[camelCase(data.name)] = [];
      const assets = await db.collection('collections').doc(id).collection('data').get();
      order.forEach(id => {
        const asset = assets.docs.find(itm => itm.id === id);
        // structuredData.collections[camelCase(data.name)].push(extend(asset.data(), { id: asset.id }));
        const assetData = asset.data();
        structuredData.collections[camelCase(data.name)].push(extend(assetData, { id: asset.id }));
      });
    }
  }
  if (userData.pages) {
    for (const id of userData.pages) {
      const item = await db.collection('pages').doc(id).get();
      const data = await item.data();
      structuredData.pages[camelCase(data.name)] = data.data;
    }
  }
  return structuredData;
};

const camelize = str => {
  return str.replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
    return index === 0 ? word.toLowerCase() : word.toUpperCase();
  }).replace(/\s+/g, '');
};

const reducer = (state = immutable.fromJS({
  collections: {},
  pages: {},
}), action) => {
  switch (action.type) {
    case STORE_DATA:
      return immutable.fromJS(action.payload);
    default:
      return state;
  }
};

const actions = {
  fetch: userId => async dispatch => {
    const data = await getData(userId);
    dispatch({
      type: STORE_DATA,
      payload: data,
    });
  },
};

const selectors = {
  collection: (state, name) => state.getIn(['reactor', 'collections', name]),
  page: (state, name) => state.getIn(['reactor', 'pages', camelize(name)]),
};

const preloadPics = data => {
  const images = [];
  Object.keys(data.collections).forEach(key => {
    data.collections[key].forEach(itm => {
      Object.keys(itm).forEach(itmKey => {
        const isImg = itmKey.toLowerCase().match(/^pic--/) &&
          itm[itmKey].toLowerCase().match(/^https?:\/\//);
        if (isImg && !images.includes(itm[itmKey])) {
          images.push(itm[itmKey]);
        }
      });
    });
  });
  Object.keys(data.pages).forEach(key => {
    Object.keys(data.pages[key]).forEach(itmKey => {
      const isImg = itmKey.toLowerCase().match(/\b(\w*pic--\w*)\b/) &&
        data.pages[key][itmKey].match && data.pages[key][itmKey].toLowerCase().match(/^https?:\/\//);
      if (isImg && !images.includes(data.pages[key][itmKey])) {
        images.push(data.pages[key][itmKey]);
      }
    });
  });
  images.forEach(src => {
    const img = new Image();
    img.src = src;
  });
};

module.exports = {
  getData,
  actions,
  reducer,
  selectors,
  preloadPics,
};
