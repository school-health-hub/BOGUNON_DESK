use super::*;
impl<B: Backend> Host<B> {
    pub fn create(&mut self) -> Result<(), Error> {
        self.completion = None;
        self.guard()?;
        let request = match self.adapter.create() {
            Ok(request) => request,
            Err(_) => return self.fault(Error::Protocol),
        };
        self.submit(request)
    }
    pub fn close(&mut self) -> Result<(), Error> {
        self.guard()?;
        let request = match self.adapter.close() {
            Ok(request) => request,
            Err(_) => return self.fault(Error::Protocol),
        };
        match request {
            Some(request) => self.submit(request),
            None => Ok(()),
        }
    }
    pub fn verify_cleanup(&mut self) -> Result<(), Error> {
        self.guard()?;
        if self.pending.is_some() {
            return self.fault(Error::Protocol);
        }
        self.pump(16)?;
        let request = match self.adapter.verify_cleanup() {
            Ok(request) => request,
            Err(_) => return self.fault(Error::Protocol),
        };
        self.submit(request)
    }
    pub fn replacement(&mut self) -> Result<(), Error> {
        self.completion = None;
        self.guard()?;
        let request = match self.adapter.replacement() {
            Ok(request) => request,
            Err(_) => return self.fault(Error::Protocol),
        };
        self.submit(request)
    }
}
