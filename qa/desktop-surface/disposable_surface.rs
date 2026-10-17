#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Generation(u64);
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct OperationId(u64);
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Ticket {
    operation: OperationId,
    generation: Generation,
}
impl Ticket {
    pub const fn generation(self) -> Generation {
        self.generation
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum State {
    Absent,
    Creating(Ticket),
    Available(Generation),
    Lost(Generation),
    Disposing(Ticket),
    Failed(Generation, Failure),
    Unsupported,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Failure {
    Create,
    Dispose,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Support {
    Supported,
    Unsupported,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Completion {
    Succeeded,
    Failed,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Error {
    Stale,
    Busy,
    AlreadyAvailable,
    ExplicitRetryRequired,
    InvalidTransition,
    Unsupported,
    RetryLimit,
    IdentityExhausted,
}

pub struct Surface {
    state: State,
    generation: Generation,
    operation: OperationId,
    retry_limit: u8,
    retries_used: u8,
}
impl Surface {
    pub const fn new(retry_limit: u8) -> Self {
        Self {
            state: State::Absent,
            generation: Generation(0),
            operation: OperationId(0),
            retry_limit,
            retries_used: 0,
        }
    }
    pub const fn state(&self) -> State {
        self.state
    }
    pub fn create(&mut self, support: Support) -> Result<Ticket, Error> {
        match self.state {
            State::Absent => self.begin_create(support),
            State::Creating(ticket) => Ok(ticket),
            State::Available(_) => Err(Error::AlreadyAvailable),
            State::Disposing(_) => Err(Error::Busy),
            State::Lost(_) | State::Failed(..) | State::Unsupported => {
                Err(Error::ExplicitRetryRequired)
            }
        }
    }
    pub fn retry_create(&mut self, support: Support) -> Result<Ticket, Error> {
        match self.state {
            State::Lost(_) | State::Failed(_, Failure::Create) | State::Unsupported => {}
            State::Absent
            | State::Creating(_)
            | State::Available(_)
            | State::Disposing(_)
            | State::Failed(_, Failure::Dispose) => {
                return Err(Error::InvalidTransition);
            }
        }
        self.check_budget()?;
        self.retries_used += 1;
        self.begin_create(support)
    }
    pub fn dispose(&mut self) -> Result<Ticket, Error> {
        match self.state {
            State::Available(_) => self.begin_dispose(),
            State::Disposing(ticket) => Ok(ticket),
            State::Failed(_, Failure::Dispose) => Err(Error::ExplicitRetryRequired),
            State::Absent
            | State::Creating(_)
            | State::Lost(_)
            | State::Failed(_, Failure::Create)
            | State::Unsupported => Err(Error::InvalidTransition),
        }
    }
    pub fn retry_dispose(&mut self) -> Result<Ticket, Error> {
        match self.state {
            State::Failed(_, Failure::Dispose) => {}
            State::Absent
            | State::Creating(_)
            | State::Available(_)
            | State::Lost(_)
            | State::Disposing(_)
            | State::Failed(_, Failure::Create)
            | State::Unsupported => {
                return Err(Error::InvalidTransition);
            }
        }
        self.check_budget()?;
        let ticket = self.begin_dispose()?;
        self.retries_used += 1;
        Ok(ticket)
    }
    pub fn created(&mut self, ticket: Ticket, completion: Completion) -> Result<(), Error> {
        self.current(ticket)?;
        match self.state {
            State::Creating(active) if active == ticket => {
                self.state = match completion {
                    Completion::Succeeded => State::Available(ticket.generation),
                    Completion::Failed => State::Failed(ticket.generation, Failure::Create),
                };
                Ok(())
            }
            _ => Err(Error::InvalidTransition),
        }
    }
    pub fn disposed(&mut self, ticket: Ticket, completion: Completion) -> Result<(), Error> {
        self.current(ticket)?;
        match self.state {
            State::Disposing(active) if active == ticket => {
                self.state = match completion {
                    Completion::Succeeded => State::Absent,
                    Completion::Failed => State::Failed(ticket.generation, Failure::Dispose),
                };
                Ok(())
            }
            _ => Err(Error::InvalidTransition),
        }
    }
    pub fn lost(&mut self, generation: Generation) -> Result<(), Error> {
        if generation != self.generation {
            return Err(Error::Stale);
        }
        match self.state {
            State::Creating(_) | State::Available(_) => {
                self.state = State::Lost(generation);
                Ok(())
            }
            State::Absent
            | State::Lost(_)
            | State::Disposing(_)
            | State::Failed(..)
            | State::Unsupported => Err(Error::InvalidTransition),
        }
    }
    fn begin_create(&mut self, support: Support) -> Result<Ticket, Error> {
        match support {
            Support::Unsupported => {
                self.state = State::Unsupported;
                return Err(Error::Unsupported);
            }
            Support::Supported => {}
        }
        let generation = Generation(
            self.generation
                .0
                .checked_add(1)
                .ok_or(Error::IdentityExhausted)?,
        );
        let ticket = self.next_ticket(generation)?;
        self.generation = generation;
        self.state = State::Creating(ticket);
        Ok(ticket)
    }
    fn begin_dispose(&mut self) -> Result<Ticket, Error> {
        let ticket = self.next_ticket(self.generation)?;
        self.state = State::Disposing(ticket);
        Ok(ticket)
    }
    fn next_ticket(&mut self, generation: Generation) -> Result<Ticket, Error> {
        let operation = OperationId(
            self.operation
                .0
                .checked_add(1)
                .ok_or(Error::IdentityExhausted)?,
        );
        self.operation = operation;
        Ok(Ticket {
            operation,
            generation,
        })
    }
    const fn current(&self, ticket: Ticket) -> Result<(), Error> {
        if ticket.operation.0 != self.operation.0 || ticket.generation.0 != self.generation.0 {
            Err(Error::Stale)
        } else {
            Ok(())
        }
    }
    const fn check_budget(&self) -> Result<(), Error> {
        if self.retries_used >= self.retry_limit {
            Err(Error::RetryLimit)
        } else {
            Ok(())
        }
    }
}
