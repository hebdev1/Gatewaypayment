import type { Product } from './store'

const descriptions: Record<string, { platform: string; description: string; beforeOrdering: string }> = {
  'free-fire': {
    platform: 'Free Fire',
    description: 'Diamonds are the in-game currency used for eligible items and offers in Free Fire.',
    beforeOrdering: 'Check which edition of Free Fire you play and which country or region your player account uses.',
  },
  'pubg-mobile': {
    platform: 'PUBG Mobile',
    description: 'UC is used for eligible content and offers inside PUBG Mobile.',
    beforeOrdering: 'Check your PUBG Mobile edition, player account and region. PUBG Mobile and regional editions may have different requirements.',
  },
  'call-of-duty': {
    platform: 'Call of Duty',
    description: 'COD Points are used for eligible content in supported Call of Duty titles.',
    beforeOrdering: 'Check the exact title, platform and account before buying. A listing for one version may not apply to another.',
  },
  'mobile-legends': {
    platform: 'Mobile Legends: Bang Bang',
    description: 'Diamonds are used for eligible in-game items and offers in Mobile Legends: Bang Bang.',
    beforeOrdering: 'Check your Mobile Legends account and server. The supplier may require both once delivery is available.',
  },
  roblox: {
    platform: 'Roblox',
    description: 'Robux is the virtual currency used for eligible purchases in the Roblox marketplace and participating experiences.',
    beforeOrdering: 'Confirm the Roblox account and the method available in your country before choosing an offer.',
  },
  valorant: {
    platform: 'VALORANT',
    description: 'VALORANT Points are used for eligible items and offers in the VALORANT store.',
    beforeOrdering: 'Match the offer to your Riot account region and platform before redeeming a code or using a top-up.',
  },
  steam: {
    platform: 'Steam Wallet',
    description: 'Steam Wallet credit is a balance you can use for eligible purchases on Steam.',
    beforeOrdering: 'Check the store country and currency on your Steam account. Wallet codes can have currency or regional restrictions.',
  },
  playstation: {
    platform: 'PlayStation Store',
    description: 'PlayStation Store gift cards add wallet credit for eligible purchases on the PlayStation Store.',
    beforeOrdering: 'The country or region of a voucher must match the country or region of your PlayStation account.',
  },
}

export function getProductDetails(product: Product) {
  return descriptions[product.id] ?? {
    platform: product.name,
    description: `${product.type} for ${product.name}.`,
    beforeOrdering: 'Check that this product matches your account, platform and region.',
  }
}
