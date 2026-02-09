#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
SRC="${REPO_ROOT}/skill/up-skills"
DEST_DIR="${HOME}/.agents/skills"
DEST="${DEST_DIR}/up-skills"

if [[ ! -d "${SRC}" ]]; then
  echo "Missing source skill directory: ${SRC}" >&2
  exit 1
fi

echo "Install up-skills skill:"
echo "  from: ${SRC}"
echo "  to:   ${DEST}"

if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "(dry-run) mkdir -p ${DEST_DIR}"
  echo "(dry-run) ln -s ${SRC} ${DEST}"
  exit 0
fi

mkdir -p "${DEST_DIR}"

if [[ -e "${DEST}" || -L "${DEST}" ]]; then
  echo "Destination already exists, removing: ${DEST}" >&2
  rm -rf "${DEST}"
fi

ln -s "${SRC}" "${DEST}"
echo "Installed. Restart Codex CLI so it re-scans ~/.agents/skills."

