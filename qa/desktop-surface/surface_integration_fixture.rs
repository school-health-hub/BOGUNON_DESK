use crate::surface_event_router::Router;
use crate::surface_event_types::{
    Action, Binding, CommandRequest, Event, MainState, Projection, RouteError,
};

pub struct Scenario {
    main: MainState,
    original_projection: Projection,
    original_note: String,
    router: Router,
    requests: Vec<CommandRequest>,
}
impl Scenario {
    pub fn new(retry_limit: u8) -> Self {
        let main = MainState::new(41, 5, String::from("synthetic authoritative unsaved work"));
        let projection = main.projection();
        let original_note = main.unsaved_note().to_owned();
        Self {
            main,
            original_projection: projection,
            original_note,
            router: Router::new(projection, retry_limit),
            requests: Vec::new(),
        }
    }
    pub fn run<T>(&mut self, transition: impl FnOnce(&mut Router) -> T) -> T {
        let result = transition(&mut self.router);
        self.assert_main();
        result
    }
    pub fn send(&mut self, binding: &Binding, sequence: u64) -> Result<(), RouteError> {
        let input = Event {
            binding: binding.clone(),
            sequence,
            action: Action::OpenMain,
        };
        let request = self.run(|router| router.accept(input))?;
        self.requests.push(request);
        self.assert_main();
        Ok(())
    }
    pub fn requests(&self) -> &[CommandRequest] {
        &self.requests
    }
    pub const fn main_projection(&self) -> Projection {
        self.main.projection()
    }
    pub fn assert_main(&self) {
        assert_eq!(self.main.projection(), self.original_projection);
        assert_eq!(self.main.unsaved_note(), self.original_note);
    }
}
