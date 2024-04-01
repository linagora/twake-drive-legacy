function "generate_tags" {
  params = [image, tags]
  result = formatlist("%s:%s", image, tags)
}

target "docker-metadata-action" {}

target "_common" {
  platforms = ["linux/amd64", "linux/arm64"]
  context = "tdrive"
  inherits = ["docker-metadata-action"]
}

target "backend" {
  inherits = ["_common"]
  dockerfile = "docker/tdrive-node/Dockerfile"
  target = "production"
  tags = concat(
    generate_tags("docker.io/twakedrive/tdrive-node", target.docker-metadata-action.tags),
    generate_tags("docker-registry.linagora.com/tdrive/tdrive-node", target.docker-metadata-action.tags),
  )
}

target "frontend" {
  inherits = ["_common"]
  dockerfile = "docker/tdrive-frontend/Dockerfile"
  tags = concat(
    generate_tags("docker.io/twakedrive/tdrive-frontend", target.docker-metadata-action.tags),
    generate_tags("docker-registry.linagora.com/tdrive/tdrive-frontend", target.docker-metadata-action.tags),
  )
}

target "onlyoffice-connector" {
  inherits = ["_common"]
  dockerfile = "docker/onlyoffice-connector/Dockerfile"
  tags = concat(
    generate_tags("docker.io/twakedrive/onlyoffice-connector", target.docker-metadata-action.tags),
    generate_tags("docker-registry.linagora.com/tdrive/onlyoffice-connector", target.docker-metadata-action.tags),
  )
}
target "ldap-sync" {
  inherits = ["_common"]
  dockerfile = "docker/tdrive-ldap-sync/Dockerfile"
  tags = concat(
    generate_tags("docker.io/twakedrive/tdrive-ldap-sync", target.docker-metadata-action.tags),
    generate_tags("docker-registry.linagora.com/tdrive/tdrive-ldap-sync", target.docker-metadata-action.tags),
  )
}
target "nextcloud-migration" {
  inherits = ["_common"]
  dockerfile = "docker/tdrive-nextcloud-migration/Dockerfile"
  tags = concat(
    generate_tags("docker.io/twakedrive˚/tdrive-nextcloud-migration", target.docker-metadata-action.tags),
    generate_tags("docker-registry.linagora.com/tdrive/tdrive-nextcloud-migration", target.docker-metadata-action.tags),
  )
}
