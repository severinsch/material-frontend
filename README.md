# Material Frontend

Frontend for the [Material API ](https://github.com/severinsch/material-api) to allow for tracking and managing materials of a scout group.

## Running locally

When running the Docker container locally using a local API instance at http://0.0.0.0:8080 use this command:

```sh
docker run -p 3000:3000 \                                                                                                                                              25s
    --add-host=host.docker.internal:host-gateway \
    -e API_URL=http://host.docker.internal:8080 \
    -e PUBLIC_API_URL=http://localhost:8080 \
    material-frontend
```