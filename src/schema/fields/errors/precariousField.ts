import { GraphQLFieldConfig, getNullableType } from "graphql"

export function precariousField(
  fieldName: string,
  fieldWithError: GraphQLFieldConfig<any, any, any>
): { [key: string]: GraphQLFieldConfig<any, any, any> } {
  if (!fieldWithError.resolve) {
    throw new Error("The given field is expected to have a resolver.")
  }
  return {
    [fieldName]: {
      ...fieldWithError,
      type: getNullableType(fieldWithError.type),
      resolve: (...args) => {
        try {
          return fieldWithError.resolve!(...args)
          // TODO: Limit to the expected error type
        } catch (error) {
          return null
        }
      },
    },
    [`${fieldName}OrError`]: {
      ...fieldWithError,
      resolve: (...args) => {
        try {
          return fieldWithError.resolve!(...args)
        } catch (error) {
          if (typeof error.toGraphQLErrorData === "function") {
            return error.toGraphQLErrorData()
          } else {
            throw error
          }
        }
      },
    },
  }
}
