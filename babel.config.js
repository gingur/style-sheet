module.exports = {
  presets: [
    [ '@babel/env', { loose: true } ]
  ],
  env: {
    test: {
      presets: [
        [ '@babel/env', { loose: true } ]
      ]
    }
  }
}
