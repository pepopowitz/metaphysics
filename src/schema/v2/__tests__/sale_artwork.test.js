import { runAuthenticatedQuery, runQuery } from "schema/v2/test/utils"
import gql from "lib/gql"
import { toGlobalId } from "graphql-relay"

describe("SaleArtwork type", () => {
  const saleArtwork = {
    id: "ed-ruscha-pearl-dust-combination-from-insects-portfolio",
    sale_id: "los-angeles-modern-auctions-march-2015",
    highest_bid: {
      cancelled: false,
      amount_cents: 325000,
      display_amount_dollars: "€3,250",
    },
    bidder_positions_count: 7,
    highest_bid_amount_cents: 325000,
    display_highest_bid_amount_dollars: "€3,250",
    minimum_next_bid_cents: 351000,
    display_minimum_next_bid_dollars: "€3,510",
    opening_bid_cents: 180000,
    display_opening_bid_dollars: "€1,800",
    low_estimate_cents: 200000,
    display_low_estimate_dollars: "€2,000",
    high_estimate_cents: 300000,
    display_high_estimate_dollars: "€3,000",
    reserve_status: "reserve_met",
    currency: "EUR",
    symbol: "€",
  }

  const execute = async (
    query,
    gravityResponse = saleArtwork,
    context = {}
  ) => {
    return await runQuery(query, {
      saleArtworkRootLoader: () => Promise.resolve(gravityResponse),
      ...context,
    })
  }

  it("formats money correctly", async () => {
    const query = gql`
      {
        node(id: "${toGlobalId("SaleArtwork", "54c7ed2a7261692bfa910200")}") {
          ... on SaleArtwork {
            highEstimate {
              cents
              amount(format: "%v EUROS!")
              display
            }
            lowEstimate {
              cents
              amount
              display
            }
            highestBid {
              cents
              amount
              display
            }
            currentBid {
              cents
              amount
              display
            }
          }
        }
      }
    `

    expect(await execute(query)).toEqual({
      node: {
        highEstimate: {
          cents: 300000,
          amount: "3,000 EUROS!",
          display: "€3,000",
        },
        lowEstimate: {
          cents: 200000,
          amount: "€2,000",
          display: "€2,000",
        },
        highestBid: {
          cents: 325000,
          amount: "€3,250",
          display: "€3,250",
        },
        currentBid: {
          cents: 325000,
          amount: "€3,250",
          display: "€3,250",
        },
      },
    })
  })

  describe("bid_increments", () => {
    it("requires an increment strategy in order to retrieve increments", async () => {
      const query = gql`
        {
          node(id: "${toGlobalId("SaleArtwork", "54c7ed2a7261692bfa910200")}") {
            ... on SaleArtwork {
              increments {
                cents
              }
            }
          }
        }
      `

      const gravityResponse = {
        ...saleArtwork,
        minimumNextBidCents: 2400000000,
      }

      const context = {
        saleLoader: () => Promise.resolve({ missingIncrementStrategy: true }),
        incrementsLoader: () => Promise.resolve(),
      }

      await expect(
        execute(query, gravityResponse, context)
      ).rejects.toHaveProperty(
        "message",
        expect.stringContaining("Missing increment strategy")
      )
    })

    it("can return bid increments that are above the size of a GraphQLInt", async () => {
      const query = gql`
        {
          node(id: "${toGlobalId("SaleArtwork", "54c7ed2a7261692bfa910200")}") {
            ... on SaleArtwork {
              increments {
                cents
              }
            }
          }
        }
      `

      const gravityResponse = {
        ...saleArtwork,
        minimum_next_bid_cents: 2400000000,
      }

      const context = {
        saleLoader: () => {
          return Promise.resolve({
            minimum_next_bid_cents: 2400000000,
            increment_strategy: "default",
          })
        },
        incrementsLoader: sale => {
          return Promise.resolve([
            {
              key: sale.increment_strategy,
              increments: [
                {
                  from: 0,
                  to: 3000000000,
                  amount: 1000,
                },
              ],
            },
          ])
        },
      }

      const data = await execute(query, gravityResponse, context)
      expect(data.node.increments.slice(0, 20).map(i => i.cents)).toEqual([
        2400000000,
        2400001000,
        2400002000,
        2400003000,
        2400004000,
        2400005000,
        2400006000,
        2400007000,
        2400008000,
        2400009000,
        2400010000,
        2400011000,
        2400012000,
        2400013000,
        2400014000,
        2400015000,
        2400016000,
        2400017000,
        2400018000,
        2400019000,
      ])
    })

    it("can return the bid increments, including Grav's asking price, and snap to preset increments", async () => {
      const query = gql`
        {
          node(id: "${toGlobalId("SaleArtwork", "54c7ed2a7261692bfa910200")}") {
            ... on SaleArtwork {
              increments {
                cents
              }
            }
          }
        }
      `

      const context = {
        saleLoader: () => {
          return Promise.resolve({
            increment_strategy: "default",
          })
        },
        incrementsLoader: sale => {
          return Promise.resolve([
            {
              key: sale.increment_strategy,
              increments: [
                {
                  from: 0,
                  to: 399999,
                  amount: 5000,
                },
                {
                  from: 400000,
                  to: 1000000,
                  amount: 10000,
                },
              ],
            },
          ])
        },
      }

      const data = await execute(query, saleArtwork, context)
      expect(data.node.increments.slice(0, 20).map(i => i.cents)).toEqual([
        351000,
        355000,
        360000,
        365000,
        370000,
        375000,
        380000,
        385000,
        390000,
        395000,
        400000,
        410000,
        420000,
        430000,
        440000,
        450000,
        460000,
        470000,
        480000,
        490000,
      ])
    })

    it("formats bid increments", async () => {
      const query = gql`
        {
          node(id: "${toGlobalId("SaleArtwork", "54c7ed2a7261692bfa910200")}") {
            ... on SaleArtwork {
              increments {
                cents
                display
              }
            }
          }
        }
      `

      const context = {
        saleLoader: () => {
          return Promise.resolve({
            increment_strategy: "default",
          })
        },
        incrementsLoader: sale => {
          return Promise.resolve([
            {
              key: sale.increment_strategy,
              increments: [
                {
                  from: 0,
                  to: 399999,
                  amount: 5000,
                },
                {
                  from: 400000,
                  to: 1000000,
                  amount: 10000,
                },
              ],
            },
          ])
        },
      }

      const data = await execute(query, saleArtwork, context)
      expect(data.node.increments.slice(0, 2)).toEqual([
        {
          cents: 351000,
          display: "€3,510",
        },
        {
          cents: 355000,
          display: "€3,550",
        },
      ])
    })
  })

  describe("my_increments", () => {
    let context

    const query = gql`
      {
        node(id: "${toGlobalId("SaleArtwork", "54c7ed2a7261692bfa910200")}") {
          ... on SaleArtwork {
            increments(useMyMaxBid: true) {
              cents
              display
            }
          }
        }
      }
    `

    beforeEach(() => {
      context = {
        saleLoader: () => {
          return Promise.resolve({ increment_strategy: "default" })
        },
        saleArtworkRootLoader: () => Promise.resolve(saleArtwork),
        lotStandingLoader: () => null,
        incrementsLoader: sale => {
          return Promise.resolve([
            {
              key: sale.increment_strategy,
              increments: [
                {
                  from: 0,
                  to: 399999,
                  amount: 5000,
                },
                {
                  from: 400000,
                  to: 1000000,
                  amount: 10000,
                },
              ],
            },
          ])
        },
      }
    })

    it("returns increments from the minimum next bid cents if the user has no lot standings", async () => {
      const data = await runAuthenticatedQuery(query, context)
      expect(data.node.increments.slice(0, 5)).toEqual([
        {
          cents: 351000,
          display: "€3,510",
        },
        {
          cents: 355000,
          display: "€3,550",
        },
        {
          cents: 360000,
          display: "€3,600",
        },
        {
          cents: 365000,
          display: "€3,650",
        },
        {
          cents: 370000,
          display: "€3,700",
        },
      ])
    })

    it("returns increments from the most recent bid if you are leading", async () => {
      const lotStandingLoader = () => {
        return [
          {
            max_position: { max_bid_amount_cents: 390000 },
            leading_position: { max_bid_amount_cents: 390000 },
          },
        ]
      }

      const data = await execute(query, saleArtwork, {
        ...context,
        lotStandingLoader: lotStandingLoader,
      })
      expect(data.node.increments.slice(0, 5)).toEqual([
        {
          cents: 395000,
          display: "€3,950",
        },
        {
          cents: 400000,
          display: "€4,000",
        },
        {
          cents: 410000,
          display: "€4,100",
        },
        {
          cents: 420000,
          display: "€4,200",
        },
        {
          cents: 430000,
          display: "€4,300",
        },
      ])
    })

    it("returns increments from the minimum_next_bid_cents if you are not leading", async () => {
      const lotStandingLoader = () => {
        return [
          {
            max_position: { max_bid_amount_cents: 340000 },
            leading_position: null,
          },
        ]
      }

      const data = await execute(query, saleArtwork, {
        ...context,
        lotStandingLoader: lotStandingLoader,
      })
      expect(data.node.increments.slice(0, 5)).toEqual([
        {
          cents: 351000,
          display: "€3,510",
        },
        {
          cents: 355000,
          display: "€3,550",
        },
        {
          cents: 360000,
          display: "€3,600",
        },
        {
          cents: 365000,
          display: "€3,650",
        },
        {
          cents: 370000,
          display: "€3,700",
        },
      ])
    })
  })

  describe("calculatedCost", () => {
    it("returns calculatedCost", async () => {
      const query = gql`
        {
          node(id: "${toGlobalId("SaleArtwork", "54c7ed2a7261692bfa910200")}") {
            ... on SaleArtwork {
              calculatedCost(bidAmountCents: 1000000) {
                buyersPremium {
                  cents
                  display
                }
                subtotal {
                  cents
                  display
                }
              }
            }
          }
        }
      `

      const data = await execute(query, saleArtwork, {
        saleArtworkRootLoader: () => Promise.resolve(saleArtwork),
      })

      expect(data).toEqual({
        node: {
          calculatedCost: {
            buyersPremium: {
              cents: 200000,
              display: "$2,000.00",
            },
            subtotal: {
              cents: 1200000,
              display: "$12,000.00",
            },
          },
        },
      })
    })
  })
})
