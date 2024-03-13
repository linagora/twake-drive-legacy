function "generate_tags" {
  params = [image, tags]
  result = formatlist("%s:%s", image, tags)
}

variable "GITHUB_REF_NAME" {
  default = "$GITHUB_REF_NAME"
}

target "docker-metadata-action" { tags = ["latest"] }

target "_common" {
  platforms = ["linux/amd64", "linux/arm64"]
  context = "tdrive"
  inherits = ["docker-metadata-action"]
  args = {
    VERSION = "$GITHUB_REF_NAME"
  }
}

target "backend" {
  inherits = ["_common"]
  dockerfile = "docker/tdrive-node/Dockerfile"
  target = "production"
  tags = concat(
    generate_tags("docker.io/linagora/tdrive-node", target.docker-metadata-action.tags),
    generate_tags("docker-registry.linagora.com/tdrive/tdrive-node", target.docker-metadata-action.tags),
  )
}

target "frontend" {
  inherits = ["_common"]
  dockerfile = "docker/tdrive-frontend/Dockerfile"
  tags = concat(
    generate_tags("docker.io/linagora/tdrive-frontend", target.docker-metadata-action.tags),
    generate_tags("docker-registry.linagora.com/tdrive/tdrive-frontend", target.docker-metadata-action.tags),
  )
}

target "onlyoffice-connector" {
  inherits = ["_common"]
  dockerfile = "docker/onlyoffice-connector/Dockerfile"
  tags = concat(
    generate_tags("docker.io/linagora/onlyoffice-connector", target.docker-metadata-action.tags),
    generate_tags("docker-registry.linagora.com/tdrive/onlyoffice-connector", target.docker-metadata-action.tags),
  )
}
target "ldap-sync" {
  inherits = ["_common"]
  dockerfile = "docker/tdrive-ldap-sync/Dockerfile"
  tags = concat(
    generate_tags("docker.io/linagora/tdrive-ldap-sync", target.docker-metadata-action.tags),
    generate_tags("docker-registry.linagora.com/tdrive/tdrive-ldap-sync", target.docker-metadata-action.tags),
  )
}
target "nextcloud-migration" {
  inherits = ["_common"]
  dockerfile = "docker/tdrive-nextcloud-migration/Dockerfile"
  tags = concat(
    generate_tags("docker.io/linagora/tdrive-nextcloud-migration", target.docker-metadata-action.tags),
    generate_tags("docker-registry.linagora.com/tdrive/tdrive-nextcloud-migration", target.docker-metadata-action.tags),
  )
}
