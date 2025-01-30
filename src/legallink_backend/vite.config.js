export default {
    build: {
      rollupOptions: {
        external: [
          "node:async_hooks",
          "child_process",
          "tls",
          "fs",
          "net",
          "http",
          "https",
          "os",
          "path",
          "stream",
          "util",
        ],
      },
    },
  };
  