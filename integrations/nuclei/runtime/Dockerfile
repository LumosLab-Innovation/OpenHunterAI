ARG NUCLEI_IMAGE=projectdiscovery/nuclei:v3.4.10
FROM ${NUCLEI_IMAGE}
COPY integrations/nuclei/templates /opt/openhunter/nuclei-templates
ENTRYPOINT ["nuclei"]
