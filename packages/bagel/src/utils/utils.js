// @flow
type Iteratee = (value: any, key: string, object: Object) => any;
type MapValues = (object: Object, iteratee: Iteratee) => {[string]: any} | {};

const mapValues: MapValues = (object, iteratee) =>
  Object.keys(object).reduce((acc, key) => {
    acc[key] = iteratee(object[key], key, object);
    return acc;
  }, {});

const groupObjectsByKeys = (objects: Array<Object>): {[string]: Array<any>} =>
  objects.reduce((acc, object) => {
    Object.keys(object).forEach(key => {
      if (!acc[key]) {
        acc[key] = [object[key]];
      } else if (Array.isArray(acc[key])) {
        acc[key].push(object[key]);
      }
    });
    return acc;
  }, {});

export {mapValues, groupObjectsByKeys};
