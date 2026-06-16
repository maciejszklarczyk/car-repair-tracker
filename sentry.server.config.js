import * as Sentry from "@sentry/astro";

Sentry.init({
  dsn: "https://48835939e8c3a2717cb2e7f1db3396ae@o4509270009839616.ingest.de.sentry.io/4511576538021968",
  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/astro/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});
