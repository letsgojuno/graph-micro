const { ApolloServer, gql } = require('apollo-server-micro');
const fetch = require('node-fetch');
const _ = require('lodash');
const getRemoteSchemas = require('./get-remote-schemas');
const { makeExecutableSchema, mergeSchemas } = require('graphql-tools');
const { HttpLink } = require('apollo-link-http');

const delay = ms => new Promise(res => setTimeout(res, ms));

const typeDefs = gql`
  type Query {
    sayHello: String
    employee: Person
    rates(currency: String!): ExchangeRates
  }

  type Person {
    name: String!
    age: Int!
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

const typeExtension = gql`
  extend type User {
    pokemon: Pokemon
    age: Int
  }
`;

const resolvers = {
  Query: {
    sayHello(parent, args, context) {
      return 'Hello Worldasdfasfd!';
    },

    employee: () => ({ name: 'Michael', age: 123 }),

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
    currency(parent, args, context) {
      return parent.data.currency;
    },

    rates: async ({ data: { rates } }, { first }) => {
      let currencyData;
      try {
        const results = await fetch('https://api.coinbase.com/v2/currencies');
        currencyData = await results.json();
      } catch (e) {
        console.error(e);
      }

      const paginated = _.map(rates, (rate, currency) => {
        const currencyInfo = currencyData.data.find(
          c => c.id.toUpperCase() === currency
        );
        return {
          name: currencyInfo ? currencyInfo.name : null,
          currency,
          rate
        };
      });

      return paginated.slice(0, Math.min(first, paginated.length));
    }
  }
};

const local = makeExecutableSchema({
  typeDefs,
  resolvers
});

module.exports = async (req, res) => {
  const schemas = await getRemoteSchemas([
    'https://fakerql.com/graphql',
    'https://graphql-pokemon.now.sh'
  ]);

  const combinedSchemas = mergeSchemas({
    schemas: [local, ...schemas, typeExtension],

    resolvers: {
      User: {
        async age() {
          await delay(3000); // Potential API call.
          return 123;
        },

        pokemon(parent, args, context, info) {
          return info.mergeInfo.delegateToSchema({
            schema: schemas[1],
            operation: 'query',
            fieldName: 'pokemon',
            args: {
              name: 'Pikachu'
            },
            context,
            info
          });
        }
      }
    }
  });

  const apolloServer = new ApolloServer({ schema: combinedSchemas });
  return apolloServer.createHandler()(req, res);
};
