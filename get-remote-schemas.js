const fetch = require('node-fetch');
const {
  makeRemoteExecutableSchema,
  introspectSchema
} = require('graphql-tools');
const { HttpLink } = require('apollo-link-http');

const getRemoteSchema = async uri => {
  const link = new HttpLink({ uri, fetch });
  const schema = await introspectSchema(link);
  return makeRemoteExecutableSchema({ schema, link });
};

const getRemoteSchemas = async uris => {
  return Promise.all(uris.map(uri => getRemoteSchema(uri)));
};

module.exports = getRemoteSchemas;
