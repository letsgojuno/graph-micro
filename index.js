const { ApolloServer, gql } = require('apollo-server-micro');
const fetch = require('node-fetch');
const _ = require('lodash');
const {
  makeExecutableSchema,
  makeRemoteExecutableSchema,
  mergeSchemas,
  introspectSchema
} = require('graphql-tools');
const { HttpLink } = require('apollo-link-http');

const typeDefs = gql`
  type Person {
    name: String!
    age: Int!
  }

  type Query {
    sayHello: String
    author: Person
    rates(currency: String!): ExchangeRates
  }

  type ExchangeRates {
    currency: String
    rates(first: Int = 2): [ExchangeRate]
  }

  type ExchangeRate {
    currency: String
    rate: String
    name: String
  }
`;

const resolvers = {
  Query: {
    sayHello(parent, args, context) {
      return 'Hello World!';
    },
    author: () => ({ name: 'Michael', age: 123 }),
    rates: async (root, { currency }) => {
      try {
        const results = await fetch(
          `https://api.coinbase.com/v2/exchange-rates?currency=${currency}`
        );
        return results.json();
      } catch (e) {
        console.error(e);
      }
    }
  },
  ExchangeRates: {
    currency: ({ data: { currency } }) => currency,
    rates: async ({ data: { rates } }, { first }) => {
      let currencyData;
      try {
        const results = await fetch('https://api.coinbase.com/v2/currencies');
        currencyData = await results.json();
      } catch (e) {
        console.error(e);
      }

      const tmp = _.map(rates, (rate, currency) => {
        const currencyInfo = currencyData.data.find(
          c => c.id.toUpperCase() === currency
        );

        return {
          name: currencyInfo ? currencyInfo.name : null,
          currency,
          rate
        };
      });

      return tmp.slice(0, Math.min(first, tmp.length));
    }
  }
};

const local = makeExecutableSchema({
  typeDefs,
  resolvers
});

const getRemoteSchema = async () => {
  const link = new HttpLink({ uri: 'https://fakerql.com/graphql', fetch });
  const remoteSchema = await introspectSchema(link);
  return makeRemoteExecutableSchema({
    schema: remoteSchema,
    link
  });
};

module.exports = async (req, res) => {
  const remote = await getRemoteSchema();
  const schema = mergeSchemas({
    schemas: [local, remote]
  });
  const apolloServer = new ApolloServer({ schema });

  return apolloServer.createHandler()(req, res);
};
