// Realistic Unsplash "Asset.Basic" objects (fields this app actually
// reads), captured against the live API during development — shared by
// UnsplashProvider.test.ts and e2e/unsplash-search.spec.ts's mocked
// route, so both layers exercise the same, real response shape without
// ever making a live network call (per the standing "mock external APIs
// in specs" rule).

export const MOUNTAIN_PHOTO = {
  id: "Bkci_8qcdvQ",
  width: 5760,
  height: 3840,
  description: "Wet mountain valley",
  urls: {
    raw: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b",
    full: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?fm=jpg",
    regular: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1080",
    small: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400",
    thumb: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=200"
  },
  links: {
    html: "https://unsplash.com/photos/Bkci_8qcdvQ",
    download_location: "https://api.unsplash.com/photos/Bkci_8qcdvQ/download?ixid=mock-ixid-1"
  },
  user: {
    name: "Kalen Emsley",
    links: { html: "https://unsplash.com/@kalenemsley" }
  }
};

export const DESERT_PHOTO = {
  id: "8mikJ83LmSQ",
  width: 4000,
  height: 6000,
  description: "Sand dunes at sunset",
  urls: {
    raw: "https://images.unsplash.com/photo-1509316785289-025f5b846b35",
    full: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?fm=jpg",
    regular: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=1080",
    small: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=400",
    thumb: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=200"
  },
  links: {
    html: "https://unsplash.com/photos/8mikJ83LmSQ",
    download_location: "https://api.unsplash.com/photos/8mikJ83LmSQ/download?ixid=mock-ixid-2"
  },
  user: {
    name: "Jane Doe",
    links: { html: "https://unsplash.com/@janedoe" }
  }
};

export const UNSPLASH_SEARCH_FIXTURE = {
  total: 2,
  total_pages: 1,
  results: [MOUNTAIN_PHOTO, DESERT_PHOTO]
};
