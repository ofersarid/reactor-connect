import 'firebase/firestore';
import 'firebase/auth';
import 'firebase/storage';
import 'firebase/database';
import Promise from 'promise';
import firebase from 'firebase/app';
import camelCase from 'lodash/camelCase';
import { fromJS } from 'immutable';

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
    messagingSenderId: '198256799515',
  });
}

const getData = (userId) => {
  const db = firebase.firestore();
  return new Promise((resolve, reject) => {
    db.collection('users').doc(userId).get().then((doc) => {
      const data = doc.data();
      const promises = [];
      data.collections.forEach(collectionId => {
        promises.push(db.collection('collections').doc(collectionId).get());
        promises.push(db.collection('collections').doc(collectionId).collection('data').get());
      });
      data.pages.forEach(pageId => {
        promises.push(db.collection('pages').doc(pageId).get());
      });
      Promise.all(promises).then(data => {
        let name;
        let subCollectionOrder;
        data.forEach(d => {
          if (d.data) { // if true than this is a document
            const docData = d.data();
            name = docData.name;
            if (!docData.layout) {
              // this is a page
              structuredData.pages[camelCase(name)] = docData.data;
            } else {
              // this is collection
              subCollectionOrder = docData.order.length > 0 ? docData.order.split(' | ') : [];
              structuredData.collections[camelCase(name)] = [];
            }
          } else {
            // this is a sub collection
            const items = [];
            subCollectionOrder.forEach(id => {
              const doc = d.docs.find(doc => doc.id === id).data();
              // preloadImages(doc);
              items.push(Object.assign({ id }, doc));
            });

            structuredData.collections[camelCase(name)] = items;
          }
        });
        resolve(structuredData);
      });
    });
  });
};

const camelize = str => {
  return str.replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
    return index === 0 ? word.toLowerCase() : word.toUpperCase();
  }).replace(/\s+/g, '');
};

const reducer = (state = fromJS({
  collections: {},
  pages: {},
}), action) => {
  switch (action.type) {
    case STORE_DATA:
      return fromJS(action.payload);
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
        const isImg = itmKey.toLowerCase().match(/\b(\w*pic--\w*)\b/) &&
          itm[itmKey].match && itm[itmKey].toLowerCase().match(/^https?:\/\//);
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

export default {
  getData,
  actions,
  reducer,
  selectors,
  preloadPics,
};
