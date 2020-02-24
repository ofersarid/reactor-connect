require('firebase/firestore');
require('firebase/auth');
require('firebase/storage');
require('firebase/database');
const firebase = require('firebase/app');
const camelCase = require('lodash/camelCase');
const immutable = require('immutable');
const RF = require('redux-firestore');
const RRF = require('react-redux-firebase');
const Redux = require('redux');

const composeEnhancers = window ? (window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || Redux.compose) : Redux.compose;

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
        const assetData = asset.data();
        assetData.id = asset.id;
        structuredData.collections[camelCase(data.name)].push(assetData);
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

const reducer = (state = immutable.fromJS({
  collections: {},
  pages: {},
  ready: false,
}), action) => {
  switch (action.type) {
    case STORE_DATA:
      return immutable.fromJS(Object.assign({}, action.payload, { ready: true }));
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
  collection: (state, name) => {
    return state.getIn(['reactor', 'collections', camelCase(name)]).toJS();
  },
  page: (state, name) => state.getIn(['reactor', 'pages', camelCase(name)]).toJS(),
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

const middleware = composeEnhancers(RF.reduxFirestore(firebase));

const connect = RRF.firestoreConnect(props => {
  let aggregated = [{
    collection: 'users',
    doc: _userId,
  }];
  if (props.resourceList) {
    aggregated = aggregated.concat(props.resourceList.collections.reduce((list, id) => {
      list.push({
        collection: 'collections',
        doc: id,
      });
      list.push({
        collection: 'collections',
        doc: id,
        subcollections: [{
          collection: 'data',
        }],
      });
      return list;
    }, []));

    aggregated = aggregated.concat(props.resourceList.pages.reduce((accumulator, id) => {
      accumulator.push({
        collection: 'pages',
        doc: id,
      });
      return accumulator;
    }, []));
  }
  return aggregated;
});

module.exports = {
  getData,
  actions,
  reducer,
  realTimeReducer: RF.firestoreReducer,
  selectors,
  preloadPics,
  middleware,
  connect,
};
