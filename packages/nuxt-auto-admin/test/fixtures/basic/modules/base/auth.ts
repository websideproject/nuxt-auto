// Open auth config for fixture tests — focuses on module functionality, not auth rules
export const usersAuth = {
  permissions: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
}

export const postsAuth = {
  permissions: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
}

// The audit log is read-only through the API: the plugin writes it on the server.
export const auditLogsAuth = {
  permissions: {
    read: () => true,
  },
}
