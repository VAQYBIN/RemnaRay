# Section 20.5: the dump needs `pg_dump` of the server's own major version, and
# the optional S3 copy needs a MinIO client. Both are pinned here so a missing
# package fails the image build in CI rather than a backup at three in the
# morning.
ARG POSTGRES_VERSION=18-alpine

FROM postgres:${POSTGRES_VERSION}

ARG MINIO_CLIENT_VERSION=0.20250813.083541-r8

RUN apk add --no-cache "minio-client=${MINIO_CLIENT_VERSION}" \
    && mcli --version \
    && rm -rf /var/cache/apk/*

ENTRYPOINT ["/bin/sh", "/scripts/backup-entrypoint.sh"]
CMD ["run"]
