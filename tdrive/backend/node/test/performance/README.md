# Performance Tests

## Developer guide

### Getting started

1. Install k6 if you want to run it locally or user docker image

``` 
https://grafana.com/docs/k6/latest/set-up/install-k6/
```

2. Run all tests

```sh
k6 run --vus 10 -e BACKEND=https://tdrive.qa.lin-saas.com -e COMPANY_ID=00000000-0000-4000-0000-000000000000 -e JWT= files/upload-files.js  
```

