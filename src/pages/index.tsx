import { useEffect } from 'react'
import next, { NextPage, NextPageContext } from 'next'
import { gql, useQuery } from '@apollo/client'
import {
  WalletDisconnectButton,
  WalletMultiButton,
} from '@solana/wallet-adapter-react-ui'
import { isNil, modify, map, filter, pipe, prop, isEmpty, not } from 'ramda'
import { AppProps } from 'next/app'
import Select, { OptionsType, ValueType } from 'react-select'
import { useForm, Controller } from 'react-hook-form'
import client from '../client'
import { useState } from 'react'
import NFTCard from '../components/NFTCard'

const SUBDOMAIN = process.env.MARKETPLACE_SUBDOMAIN

type OptionType = { label: string; value: number }
const solSymbol = '◎'

interface Nft {
  name: string
  address: string
  uri: string
  creators: string[]
  description: string
  image: string
}

interface GetNftsData {
  nfts: Nft[]
  creator: Creator
}

const GET_NFTS = gql`
  query GetNfts($creators: [String!]!, $attributes: [AttributeFilter!]) {
    nfts(creators: $creators, attributes: $attributes) {
      address
      name
      description
      image
    }
  }
`

const GET_SIDEBAR = gql`
  query GetSidebar($address: String!) {
    creator(address: $address) {
      attributeGroups {
        name
        variants {
          name
          count
        }
      }
    }
  }
`

export async function getServerSideProps({ req }: NextPageContext) {
  const subdomain = req?.headers['x-holaplex-subdomain'];

  const {
    data: { storefront },
  } = await client.query<GetStorefront>({
    query: gql`
      query GetStorefront($subdomain: String!) {
        storefront(subdomain: $subdomain) {
          title
          description
          logoUrl
          faviconUrl
          bannerUrl
          ownerAddress
        }
      }
    `,
    variables: {
      subdomain: (subdomain || SUBDOMAIN),
    },
  })

  if (isNil(storefront)) {
    return {
      notFound: true,
    }
  }

  return {
    props: {
      storefront,
    },
  }
}

interface Storefront {
  title: string
  description: string
  logoUrl: string
  bannerUrl: string
  faviconUrl: string
  subdomain: string
  ownerAddress: string
}

export interface Marketplace {
  subdomain: string,
  name: string,
  description: string,
  logoUrl: string,
  bannerUrl: string,
  auctionHouseAddress: string
}

interface AuctionHouse {
  address: string
  treasury_mint: string
  auction_house_treasury: string
  treasury_withdrawal_destination: string
  fee_withdrawal_destination: string
  authority: string
  creator: string
  auction_house_fee_account: string
  bump: Number
  treasury_bump: Number
  fee_payer_bump: Number 
  seller_fee_basis_points: Number
  requires_sign_off: boolean
  can_change_sale_price: boolean
}

interface AttributeVariant {
  name: string
  count: number
}
interface AttributeGroup {
  name: string
  variants: AttributeVariant[]
}

interface Creator {
  addresss: string
  attributeGroups: AttributeGroup[]
}

interface GetStorefront {
  storefront: Storefront | null
}

interface GetMarketplace {
  marketplace: Marketplace | null
}

interface GetSidebar {
  creator: Creator
}

interface HomePageProps extends AppProps {
  storefront: Storefront
}

interface AttributeFilter {
  traitType: string
  values: string[]
}
interface NFTFilterForm {
  attributes: AttributeFilter[]
}
const Home: NextPage<HomePageProps> = ({ storefront }) => {
  const nfts = useQuery<GetNftsData>(GET_NFTS, {
    variables: {
      creators: [storefront.ownerAddress],
    },
  })

  const sidebar = useQuery<GetSidebar>(GET_SIDEBAR, {
    variables: {
      address: storefront.ownerAddress,
    },
  })

  const { control, watch } = useForm<NFTFilterForm>({})

  useEffect(() => {
    const subscription = watch(({ attributes }) => {
      const next = pipe(
        filter(pipe(prop('values'), isEmpty, not)),
        map(modify('values', map(prop('value'))))
      )(attributes)

      nfts.refetch({
        creators: [storefront.ownerAddress],
        attributes: next,
      })
    })
    return () => subscription.unsubscribe()
  }, [watch])

  const [showXsFilter, setShowXsFilter] = useState(false)

  return (
    <div className='flex flex-col items-center text-white bg-gray-900'>
      {showXsFilter && (
        <div className='fixed z-20 w-full h-full px-4 py-4 pt-24 bg-black'>
          <button
            className='fixed z-30 right-[7%] top-[3%] bg-black text-white rounded-full w-6'
            onClick={() => setShowXsFilter(false)}
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              width='50'
              height='50'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='0.5'
              strokeLinecap='round'
              strokeLinejoin='round'
              className='feather feather-x-circle'
            >
              <circle cx='12' cy='12' r='10'></circle>
              <line x1='15' y1='9' x2='9' y2='15'></line>
              <line x1='9' y1='9' x2='15' y2='15'></line>
            </svg>
          </button>
          <form
            onSubmit={e => {
              e.preventDefault()
            }}
          >
            <div className='flex flex-col flex-grow mb-6'>
              <div className='flex justify-between w-full p-2 rounded-md'>
                <h4>Current listings</h4>
                <span className='text-sm text-gray-500'>0</span>
              </div>
              <div className='flex justify-between w-full p-2 rounded-md'>
                <h4>Owned by me</h4>
                <span className='text-sm text-gray-500'>0</span>
              </div>
              <div className='flex justify-between w-full p-2 bg-gray-800 rounded-md'>
                <h4>Unlisted</h4>
                <span className='text-sm text-gray-500'>0</span>
              </div>
            </div>
            <div className='flex flex-col flex-grow gap-4'>
              {sidebar.data?.creator.attributeGroups.map(
                ({ name: group, variants }, index) => (
                  <div className='flex flex-col flex-grow gap-2' key={group}>
                    <label>
                      {group.charAt(0).toUpperCase() + group.slice(1)}
                    </label>
                    <Controller
                      control={control}
                      name={`attributes.${index}`}
                      defaultValue={{ traitType: group, values: [] }}
                      render={({ field: { onChange, value } }) => {
                        return (
                          <Select
                            value={value.values}
                            isMulti
                            className='select-base-theme'
                            classNamePrefix='base'
                            onChange={(next: ValueType<OptionType>) => {
                              onChange({ traitType: group, values: next })
                            }}
                            formatOptionLabel={(elem: ValueType<OptionType>) =>
                              elem.label
                                .split(' ')
                                .slice(0, -1)
                                .join(' ') +
                              ' (' +
                              elem.label.split(' ').at(-1) +
                              ')'
                            }
                            options={
                              variants.map(({ name, count }) => ({
                                value: name,
                                label: `${name} ${count}`,
                              })) as OptionsType<OptionType>
                            }
                          />
                        )
                      }}
                    />
                  </div>
                )
              )}
            </div>
          </form>
        </div>
      )}

      <div className='relative w-full'>
        <div className="absolute right-8 top-8">
          <WalletMultiButton>Connect</WalletMultiButton>
        </div>

        <img src={storefront.bannerUrl} alt={storefront.title} className='object-cover w-full h-80' />
      </div>

      <div className='w-full max-w-[1800px] px-8'>

        <div className='relative flex flex-col justify-between w-full mt-20 mb-20'>
          <img
            src={storefront.logoUrl}
            alt={storefront.title}
            className='absolute border-4 border-gray-900 rounded-full w-28 h-28 -top-32'
          />
          <h1>{storefront.title}</h1>
          <p className='mt-4 max-w-prose'>{storefront.description}</p>
        </div>

        <div className='flex'>
          <button
            className='fixed rounded-full text-black bg-white h-10 right-[25%] w-[50%] z-10 block sm:hidden bottom-5'
            onClick={() => setShowXsFilter(true)}
          >
            Filter
          </button>

          <div className='flex-row flex-none hidden w-64 mr-10 space-y-2 sm:block'>
            <form
              onSubmit={e => {
                e.preventDefault()
              }}
              className='sticky top-0 py-4 max-h-screen overflow-auto'
            >
              <div className='flex flex-col flex-grow mb-6'>
                <div className='flex justify-between w-full px-4 py-2 mb-1 rounded-md cursor-pointer hover:bg-gray-800'>
                  <h4>Current listings</h4>
                  <span className='text-sm text-gray-500'>0</span>
                </div>
                <div className='flex justify-between w-full px-4 py-2 mb-1 rounded-md cursor-pointer hover:bg-gray-800'>
                  <h4>Owned by me</h4>
                  <span className='text-sm text-gray-500'>0</span>
                </div>
                <div className='flex justify-between w-full px-4 py-2 mb-1 bg-gray-800 rounded-md cursor-pointer hover:bg-gray-800'>
                  <h4>Unlisted</h4>
                  <span className='text-sm text-gray-500'>0</span>
                </div>
              </div>
              <div className='flex flex-col flex-grow gap-4'>
                {sidebar.data?.creator.attributeGroups.map(
                  ({ name: group, variants }, index) => (
                    <div className='flex flex-col flex-grow gap-2' key={group}>
                      <label className='label'>
                        {group.charAt(0).toUpperCase() + group.slice(1)}
                      </label>

                      <Controller
                        control={control}
                        name={`attributes.${index}`}
                        defaultValue={{ traitType: group, values: [] }}
                        render={({ field: { onChange, value } }) => {
                          return (
                            <Select
                              value={value.values}
                              isMulti
                              className='select-base-theme'
                              classNamePrefix='base'
                              onChange={(next: ValueType<OptionType>) => {
                                onChange({ traitType: group, values: next })
                              }}
                              formatOptionLabel={(
                                elem: ValueType<OptionType>
                              ) =>
                                elem.label
                                  .split(' ')
                                  .slice(0, -1)
                                  .join(' ') +
                                ' (' +
                                elem.label.split(' ').at(-1) +
                                ')'
                              }
                              options={
                                variants.map(({ name, count }) => ({
                                  value: name,
                                  label: `${name} ${count}`,
                                })) as OptionsType<OptionType>
                              }
                            />
                          )
                        }}
                      />
                    </div>
                  )
                )}
              </div>
            </form>
          </div>
          <div className='grow'>
            {nfts.loading ? (
              <>Loading</>
            ) : (
              <div className='container md:mx-auto lg:mx-auto'>
                {nfts.data?.nfts.length === 0 &&
                  <div className='w-full p-10 text-center border border-gray-800 rounded-lg'>
                    <h3>No NFTs found</h3>
                    <p className='mt-2 text-gray-500'>No NFTs found matching these criteria.</p>
                  </div>
                }
                <div className='grid grid-cols-1 gap-8 mb-20 md:mb-0 2xl:gap-12 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
                  {nfts.data?.nfts.map(n => (
                    <NFTCard nft={n} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
