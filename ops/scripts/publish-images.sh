#!/usr/bin/env bash
set -euo pipefail

namespace="${DOCKERHUB_NAMESPACE:-${1:-openhunter}}"
tag="${IMAGE_TAG:-${2:-latest}}"
push_images="${PUSH:-0}"

nuclei_upstream="${NUCLEI_UPSTREAM_IMAGE:-projectdiscovery/nuclei:v3.4.10}"
zap_upstream="${ZAP_UPSTREAM_IMAGE:-ghcr.io/zaproxy/zaproxy:stable}"

build_adapter() {
  local name="$1"
  local dockerfile="integrations/${name}/Dockerfile"
  local image="${namespace}/${name}-adapter:${tag}"

  echo "Building ${image}"
  if [[ "${name}" == "nuclei" ]]; then
    docker build --build-arg "NUCLEI_IMAGE=${nuclei_upstream}" -f "${dockerfile}" -t "${image}" .
  else
    docker build -f "${dockerfile}" -t "${image}" .
  fi

  if [[ "${push_images}" == "1" || "${push_images}" == "true" ]]; then
    echo "Pushing ${image}"
    docker push "${image}"
  fi
}

echo "Pulling upstream tool images"
docker pull "${nuclei_upstream}"
docker pull "${zap_upstream}"

for integration in zaproxy nuclei openhack strix; do
  build_adapter "${integration}"
done

cat <<EOF

Images ready:
  ZAP_IMAGE=${zap_upstream}
  NUCLEI_IMAGE=${nuclei_upstream}
  ZAPROXY_ADAPTER_IMAGE=${namespace}/zaproxy-adapter:${tag}
  NUCLEI_ADAPTER_IMAGE=${namespace}/nuclei-adapter:${tag}
  OPENHACK_ADAPTER_IMAGE=${namespace}/openhack-adapter:${tag}
  STRIX_ADAPTER_IMAGE=${namespace}/strix-adapter:${tag}

Use PUSH=1 to publish after docker login:
  DOCKERHUB_NAMESPACE=${namespace} IMAGE_TAG=${tag} PUSH=1 ops/scripts/publish-images.sh
EOF
