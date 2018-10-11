import {
  GraphQLFieldConfig,
  GraphQLUnionType,
  GraphQLObjectType,
  GraphQLString,
  GraphQLInterfaceType,
  GraphQLInt,
  GraphQLSchema,
  graphql,
  GraphQLBoolean,
  GraphQLNonNull,
} from "graphql"
import gql from "lib/gql"
import { precariousField } from "../errors/precariousField"

/**
 * NOTES:
 *
 * - Unions don’t support scalars, so those would need to be boxed, but usually
 *   the code that leads to errors doesn’t result in scalars anyways.
 */

const ErrorInterfaceType = new GraphQLInterfaceType({
  name: "Error",
  fields: {
    message: {
      type: GraphQLString,
    },
  },
})

const ErrorType = new GraphQLObjectType({
  interfaces: [ErrorInterfaceType],
  name: "ErrorType",
  fields: {
    message: {
      type: GraphQLString,
    },
  },
})

// TODO: Validate that interfaces conform to super interfaces
const HTTPErrorInterfaceType = new GraphQLInterfaceType({
  name: "HTTPError",
  fields: {
    message: {
      type: GraphQLString,
    },
    statusCode: {
      type: GraphQLInt,
    },
  },
})

// TODO: This typing isn’t working
interface Error {
  // toGraphQLErrorType(): GraphQLObjectType
  toGraphQLErrorData(): { [key: string]: any }
}

// Error.prototype.toGraphQLErrorType = () => ErrorType
Error.prototype.toGraphQLErrorData = function toGraphQLErrorData() {
  return { message: this.message }
}

// class Error {
//   // TODO: Narrow this type to a error object type
//   public toGraphQLErrorType(): GraphQLObjectType {
//     return ErrorType
//   }

//   public toGraphQLErrorData(): { [key: string]: any } {
//     return { message: this.message }
//   }
// }

class HTTPError extends Error {
  public readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
    Error.captureStackTrace(this, this.constructor)
  }

  toGraphQLErrorData() {
    return { ...super.toGraphQLErrorData(), statusCode: this.statusCode }
  }
}

const CustomHTTPErrorType = new GraphQLObjectType({
  interfaces: [ErrorInterfaceType, HTTPErrorInterfaceType],
  name: "CustomHTTPError",
  // Test a non-thunk
  fields: {
    message: {
      type: GraphQLString,
    },
    statusCode: {
      type: GraphQLInt,
    },
    requestID: {
      type: GraphQLString,
    },
  },
})

class CustomHTTPError extends HTTPError {
  public readonly requestID: string

  constructor(message: string, statusCode: number, requestID: string) {
    super(message, statusCode)
    this.requestID = requestID
    Error.captureStackTrace(this, this.constructor)
  }

  toGraphQLErrorData() {
    return { ...super.toGraphQLErrorData(), requestID: this.requestID }
  }
}

const ArtistType = new GraphQLObjectType({
  name: "Artist",
  // Test a thunk
  fields: () => ({
    name: {
      type: GraphQLString,
    },
  }),
})

const ArtistOrErrorUnionType: GraphQLUnionType = new GraphQLUnionType({
  name: "ArtistOrError",
  types: [ArtistType, CustomHTTPErrorType],
  resolveType: data => (data.name ? ArtistType : CustomHTTPErrorType),
})

const artistFieldWithError: GraphQLFieldConfig<any, any, any> = {
  type: new GraphQLNonNull(ArtistOrErrorUnionType),
  resolve: (_source, _args, context) => {
    if (context.succeed) {
      return { name: "picasso" }
    } else {
      throw new CustomHTTPError("Oh noes", 401, "a-request-id")
    }
  },
}

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: "Query",
    fields: {
      ...precariousField("artist", artistFieldWithError),
    },
  }),
})

describe("precariousField", () => {
  describe("concerning success", () => {
    it("works using the error field", async () => {
      const result = await graphql(
        schema,
        gql`
          {
            artistOrError {
              __typename
              ... on Artist {
                name
              }
            }
          }
        `,
        {},
        { succeed: true }
      )
      expect(result.data).toEqual({
        artistOrError: {
          __typename: "Artist",
          name: "picasso",
        },
      })
    })

    it("works using the nullable field", async () => {
      const result = await graphql(
        schema,
        gql`
          {
            artist {
              __typename
              ... on Artist {
                name
              }
            }
          }
        `,
        {},
        { succeed: true }
      )
      expect(result.data).toEqual({
        artist: {
          __typename: "Artist",
          name: "picasso",
        },
      })
    })
  })

  describe("concerning errors", () => {
    it("works using the standard error interface", async () => {
      const result = await graphql(
        schema,
        gql`
          {
            artistOrError {
              __typename
              ... on Error {
                message
              }
            }
          }
        `,
        {},
        { succeed: false }
      )
      expect(result.data).toEqual({
        artistOrError: {
          __typename: "CustomHTTPError",
          message: "Oh noes",
        },
      })
    })

    it("works using the network error interface", async () => {
      const result = await graphql(
        schema,
        gql`
          {
            artistOrError {
              __typename
              ... on HTTPError {
                message
                statusCode
              }
            }
          }
        `,
        {},
        { succeed: false }
      )
      expect(result.data).toEqual({
        artistOrError: {
          __typename: "CustomHTTPError",
          message: "Oh noes",
          statusCode: 401,
        },
      })
    })

    it("works using the exact error type", async () => {
      const result = await graphql(
        schema,
        gql`
          {
            artistOrError {
              __typename
              ... on CustomHTTPError {
                message
                statusCode
                requestID
              }
            }
          }
        `,
        {},
        { succeed: false }
      )
      expect(result.data).toEqual({
        artistOrError: {
          __typename: "CustomHTTPError",
          message: "Oh noes",
          statusCode: 401,
          requestID: "a-request-id",
        },
      })
    })

    it("works using the nullable field", async () => {
      const result = await graphql(
        schema,
        gql`
          {
            artist {
              __typename
            }
          }
        `,
        {},
        { succeed: false }
      )
      expect(result.data).toEqual({ artist: null })
    })
  })
})
