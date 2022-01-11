> Our organizational level renovate configs

When we onboard a new repository with `renovate` it will use the default config
(`default.json`) that essentially ships some sane defaults from `main.json` and
comes with a weekend execution schedule.

If you would like to override the defaults, then use something like the below:

1. To override weekend runs, remove the `weekend` key from:

   ```js
   {
    "extends": [
      "github>freecodecamp/renovate-config:main",
      ...
      ],
    ...
   }
   ```

2. To override the default config:

   ```js
   {
    "extends": [
      "github>freecodecamp/renovate-config:default",
      ...
      ],
    ...
   }
   ```

   or start from scratch:

   ```js
   {
   "extends": [
     "config:base",
     ...
     ],
   ...
   }
   ```
