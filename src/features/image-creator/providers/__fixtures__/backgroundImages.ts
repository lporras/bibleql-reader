import type { BackgroundImageLike } from "../mapBackgroundImage";

// BibleQL `BackgroundImage` objects in the shape the server returns
// (Unsplash photos, proxied). e2e/fixtures/background-images.json holds the
// same two photos for the browser suite's mocked `backgroundImages`.

export const MOUNTAIN_IMAGE: BackgroundImageLike = {
  id: "Bkci_8qcdvQ",
  width: 5760,
  height: 3840,
  urls: {
    regular: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1080",
    small: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400",
    thumb: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=200"
  },
  photographer: {
    name: "Kalen Emsley",
    username: "kalenemsley",
    profileUrl: "https://unsplash.com/@kalenemsley?utm_source=bibleql-reader&utm_medium=referral"
  },
  unsplashUrl: "https://unsplash.com/photos/Bkci_8qcdvQ?utm_source=bibleql-reader&utm_medium=referral"
};

/** Everything optional left out, as Unsplash occasionally does. */
export const SPARSE_IMAGE: BackgroundImageLike = {
  id: "8mikJ83LmSQ",
  width: null,
  height: null,
  urls: { regular: null, small: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=400", thumb: null },
  photographer: { name: "Jane Doe", username: "janedoe", profileUrl: null },
  unsplashUrl: null
};
